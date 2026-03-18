import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import fs from "fs";
import path from "path";

const app = express();
const httpServer = createServer(app);

// 确保 logs 目录存在
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 获取今天的日志文件路径
function getTodayLogPath(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(logsDir, `app-${date}.log`);
}

// 写入日志到文件，同时输出到控制台
function writeLog(message: string) {
  const logPath = getTodayLogPath();
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, line, { encoding: "utf-8" });
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const now = new Date();
  const formattedTime = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const line = `[${formattedTime}.${ms}] [${source}] ${message}`;
  console.log(line);
  writeLog(line);
}

// 格式化响应体，超长时截断
function formatResponse(body: any, maxLen = 200): string {
  const str = JSON.stringify(body);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `...(${str.length - maxLen}字符省略)`;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const responseStr = capturedJsonResponse ? formatResponse(capturedJsonResponse) : "";
      // 每条日志单独一行，格式: [时间] METHOD path status | duration | response
      log(`${req.method.padEnd(6)} ${path.padEnd(30)} ${res.statusCode} | ${duration}ms${responseStr ? " | " + responseStr : ""}`);
    }
  });

  next();
});

(async () => {
  await seedDatabase().catch((err) => console.error("Seed error:", err));
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    const errLine = `Internal Server Error: ${message}`;
    console.error(errLine);
    writeLog(`[ERROR] ${errLine}`);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
