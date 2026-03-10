import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileStack, FileCheck, AlertCircle } from "lucide-react";
import type { DashboardStats } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const cards = [
    {
      title: "费用总数",
      value: stats?.totalFees ?? 0,
      icon: FileStack,
      desc: "已导入的费用明细",
      color: "text-chart-1",
      bg: "bg-chart-1/10",
    },
    {
      title: "待配置规则",
      value: stats?.pendingRules ?? 0,
      icon: AlertCircle,
      desc: "尚未设置摊销规则",
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
    {
      title: "本月应摊销",
      value: stats ? `¥${Number(stats.currentMonthAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "¥0.00",
      icon: DollarSign,
      desc: "当月摊销总金额",
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      title: "已生成凭证",
      value: stats?.generatedVouchers ?? 0,
      icon: FileCheck,
      desc: "累计生成的凭证数",
      color: "text-chart-3",
      bg: "bg-chart-3/10",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">系统总览</h1>
        <p className="text-muted-foreground text-sm mt-1">费用摊销管理系统核心数据概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid={`stat-value-${i}`}>
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用指南</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
              <p>在「费用导入」页面上传费控平台导出的 Excel/CSV 文件，系统自动解析并去重。</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
              <p>在「科目管理」中维护借方和贷方科目，供摊销规则引用。</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
              <p>在「摊销规则」页面为每条费用设置摊销期间、方式和科目。</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</span>
              <p>在「月度摊销表」中查看自动计算的摊销明细，支持按月筛选。</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">5</span>
              <p>在「凭证管理」中批量生成当月凭证，并可通过 API 接口导出 JSON 数据对接财务系统。</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API 接口文档</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div className="p-2 rounded-md bg-muted">
              <span className="text-chart-2 font-semibold">POST</span>
              <span className="ml-2">/api/import-fee</span>
              <p className="text-xs text-muted-foreground mt-1">上传费用 Excel/CSV</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <span className="text-chart-1 font-semibold">POST</span>
              <span className="ml-2">/api/set-amort-rule</span>
              <p className="text-xs text-muted-foreground mt-1">设置摊销规则</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <span className="text-chart-4 font-semibold">GET</span>
              <span className="ml-2">/api/amort-table?month=YYYY-MM</span>
              <p className="text-xs text-muted-foreground mt-1">获取月度摊销表</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <span className="text-chart-2 font-semibold">POST</span>
              <span className="ml-2">/api/generate-voucher</span>
              <p className="text-xs text-muted-foreground mt-1">批量生成凭证</p>
            </div>
            <div className="p-2 rounded-md bg-muted">
              <span className="text-chart-4 font-semibold">GET</span>
              <span className="ml-2">/api/vouchers?month=YYYY-MM</span>
              <p className="text-xs text-muted-foreground mt-1">获取凭证列表 (JSON)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
