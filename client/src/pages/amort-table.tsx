import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { CalendarRange } from "lucide-react";
import { Link } from "wouter";
import type { AmortizationEntryWithDetails, Entity } from "@shared/schema";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AmortTablePage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  const { data: entityList = [] } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
  });

  const entityParam = selectedEntityId && selectedEntityId !== "all" ? `&entityId=${selectedEntityId}` : "";
  const { data: entries = [], isLoading } = useQuery<AmortizationEntryWithDetails[]>({
    queryKey: ["/api/amort-table", `?month=${month}${entityParam}`],
  });

  const totalAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  const selectedEntityName = selectedEntityId && selectedEntityId !== "all"
    ? entityList.find(e => e.id === Number(selectedEntityId))?.name
    : "全部主体";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-amort-title">月度摊销表</h1>
          <p className="text-muted-foreground text-sm mt-1">按主体和月份查看摊销明细</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="w-40" data-testid="select-amort-entity">
              <SelectValue placeholder="全部主体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部主体</SelectItem>
              {entityList.map((e) => (
                <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-sm text-muted-foreground whitespace-nowrap">月份:</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-48"
            data-testid="input-select-month"
          />
        </div>
      </div>

      {totalAmount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {selectedEntityName} · {month} 月度合计 ({entries.length} 条)
              </div>
              <div className="text-xl font-bold" data-testid="text-total-amount">
                ¥{totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">摊销明细</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarRange className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">该月份无摊销数据</p>
              <p className="text-xs mt-1">请切换到有摊销记录的月份，或前往</p>
              <Link href="/fees">
                <span className="text-xs text-primary underline cursor-pointer mt-1 inline-block">
                  费用导入页面 → 点击「批量生成摊销明细」
                </span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>摊销月份</TableHead>
                    <TableHead>费用编号</TableHead>
                    <TableHead>费用名称</TableHead>
                    <TableHead>所属主体</TableHead>
                    <TableHead className="text-right">本月摊销</TableHead>
                    <TableHead className="text-right">累计已摊销</TableHead>
                    <TableHead className="text-right">剩余未摊销</TableHead>
                    <TableHead>借方科目</TableHead>
                    <TableHead>贷方科目</TableHead>
                    <TableHead>凭证状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell className="font-mono">{entry.month}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.feeCode}</TableCell>
                      <TableCell>{entry.feeName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.entityName || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ¥{Number(entry.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ¥{Number(entry.cumulativeAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ¥{Number(entry.remainingAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">{entry.debitAccountName || "-"}</TableCell>
                      <TableCell className="text-sm">{entry.creditAccountName || "-"}</TableCell>
                      <TableCell>
                        {entry.voucherGenerated ? (
                          <Badge variant="default" data-testid={`badge-voucher-${entry.id}`}>已生成</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-voucher-${entry.id}`}>未生成</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
