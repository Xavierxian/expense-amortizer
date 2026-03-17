import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Sparkles, Copy, Check, Download, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import type { Voucher, Entity } from "@shared/schema";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function VouchersPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { data: entityList = [] } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
  });

  const entityParam = selectedEntityId && selectedEntityId !== "all" ? `&entityId=${selectedEntityId}` : "";
  const { data: voucherList = [], isLoading } = useQuery<Voucher[]>({
    queryKey: ["/api/vouchers", `?month=${month}${entityParam}`],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntityId || selectedEntityId === "all") {
        throw new Error("请选择具体主体后再生成凭证");
      }
      const res = await apiRequest("POST", "/api/generate-voucher", {
        month,
        entityId: Number(selectedEntityId),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "凭证生成成功",
        description: `已生成 ${data.generated} 张凭证`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "生成失败", description: e.message, variant: "destructive" });
    },
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await apiRequest("DELETE", `/api/vouchers/${entryId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "凭证已删除", description: "可重新生成凭证" });
    },
    onError: (e: Error) => {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    },
  });

  const handleCopyJson = () => {
    const jsonData = voucherList.map((v) => ({
      voucherNo: v.voucherNo,
      date: v.voucherDate,
      summary: v.summary,
      entries: [
        { direction: "debit", accountCode: v.debitAccountCode, accountName: v.debitAccountName, amount: v.amount },
        { direction: "credit", accountCode: v.creditAccountCode, accountName: v.creditAccountName, amount: v.amount },
      ],
    }));
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "已复制 JSON 到剪贴板" });
  };

  const handleExportExcel = () => {
    const rows = voucherList.map((v) => ({
      凭证号: v.voucherNo,
      日期: v.voucherDate,
      摘要: v.summary,
      借方科目代码: v.debitAccountCode || "",
      借方科目名称: v.debitAccountName || "",
      贷方科目代码: v.creditAccountCode || "",
      贷方科目名称: v.creditAccountName || "",
      金额: Number(v.amount),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 }, { wch: 12 }, { wch: 40 },
      { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "凭证列表");
    const entitySuffix = selectedEntityId && selectedEntityId !== "all"
      ? `_${entityList.find(e => e.id === Number(selectedEntityId))?.code || selectedEntityId}`
      : "";
    XLSX.writeFile(wb, `凭证_${month}${entitySuffix}.xlsx`);
    toast({ title: "导出成功", description: `已导出 ${rows.length} 张凭证` });
  };

  const totalAmount = voucherList.reduce((sum, v) => sum + Number(v.amount), 0);

  const selectedEntityName = selectedEntityId && selectedEntityId !== "all"
    ? entityList.find(e => e.id === Number(selectedEntityId))?.name
    : "全部主体";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-vouchers-title">凭证管理</h1>
          <p className="text-muted-foreground text-sm mt-1">按主体批量生成财务凭证，导出 JSON 对接财务系统</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="w-40" data-testid="select-voucher-entity">
              <SelectValue placeholder="选择主体" />
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
            data-testid="input-voucher-month"
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !selectedEntityId || selectedEntityId === "all"}
            data-testid="button-generate-voucher"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {generateMutation.isPending ? "生成中..." : "批量生成凭证"}
          </Button>
          {voucherList.length > 0 && (
            <>
              <Button variant="secondary" onClick={handleCopyJson} data-testid="button-copy-json">
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "已复制" : "复制 JSON"}
              </Button>
              <Button variant="outline" onClick={handleExportExcel} data-testid="button-export-excel">
                <Download className="w-4 h-4 mr-1" />
                导出 Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {(!selectedEntityId || selectedEntityId === "all") && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-200">
            请选择具体主体后再生成凭证。查看凭证时可选择"全部主体"。
          </CardContent>
        </Card>
      )}

      {totalAmount > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {selectedEntityName} · {month} 凭证合计 ({voucherList.length} 张)
              </div>
              <div className="text-xl font-bold" data-testid="text-voucher-total">
                ¥{totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">凭证列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : voucherList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">该月份暂无凭证</p>
              <p className="text-xs mt-1">选择主体后点击「批量生成凭证」为当月摊销数据生成凭证</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>凭证号</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>借方科目</TableHead>
                    <TableHead>贷方科目</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucherList.map((v) => (
                    <TableRow key={v.id} data-testid={`row-voucher-${v.id}`}>
                      <TableCell className="font-mono text-sm">{v.voucherNo}</TableCell>
                      <TableCell>{v.voucherDate}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{v.summary}</TableCell>
                      <TableCell className="text-sm">
                        {v.debitAccountCode ? `${v.debitAccountCode} ${v.debitAccountName}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {v.creditAccountCode ? `${v.creditAccountCode} ${v.creditAccountName}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ¥{Number(v.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteVoucherMutation.mutate(v.entryId)}
                          disabled={deleteVoucherMutation.isPending}
                          title="删除凭证"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {voucherList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API 接口地址</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded-md bg-muted font-mono text-sm">
              <p className="text-muted-foreground mb-1">GET 请求获取当月凭证 JSON 数据:</p>
              <p className="break-all" data-testid="text-api-url">
                {window.location.origin}/api/vouchers?month={month}{entityParam ? entityParam : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
