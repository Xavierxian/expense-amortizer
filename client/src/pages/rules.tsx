import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Search, CalendarDays, ArrowRight } from "lucide-react";
import type { Fee, Account, AmortizationRule } from "@shared/schema";

function feeeDateToMonth(feeDate: string): string {
  if (!feeDate) return "";
  const parts = feeDate.split("-");
  if (parts.length >= 2) return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  return "";
}

function addMonths(yearMonth: string, count: number): string {
  if (!yearMonth || count <= 0) return yearMonth;
  const [y, m] = yearMonth.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + (count - 1);
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

function monthDiff(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

export default function RulesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [search, setSearch] = useState("");
  const [ruleForm, setRuleForm] = useState({
    startMonth: "", periods: 12, method: "monthly",
    debitAccountId: "", creditAccountId: "", remark: "",
  });

  const endMonth = ruleForm.startMonth && ruleForm.periods > 0
    ? addMonths(ruleForm.startMonth, ruleForm.periods)
    : "";

  const { data: fees = [], isLoading: feesLoading } = useQuery<Fee[]>({
    queryKey: ["/api/fees"],
  });

  const { data: accts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const debitAccounts = accts.filter((a) => a.type === "debit");
  const creditAccounts = accts.filter((a) => a.type === "credit");

  const setRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/set-amort-rule", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      setDialogOpen(false);
      toast({
        title: "规则设置成功",
        description: `已生成 ${data.entriesCount} 期摊销明细（${data.rule?.startMonth} 至 ${data.rule?.endMonth}）`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "设置失败", description: e.message, variant: "destructive" });
    },
  });

  const openRuleDialog = async (fee: Fee) => {
    setSelectedFee(fee);
    const derivedStart = feeeDateToMonth(fee.feeDate);
    try {
      const res = await fetch(`/api/rules/${fee.id}`);
      const rule: AmortizationRule | null = await res.json();
      if (rule) {
        setRuleForm({
          startMonth: rule.startMonth,
          periods: monthDiff(rule.startMonth, rule.endMonth),
          method: rule.method,
          debitAccountId: rule.debitAccountId?.toString() || "",
          creditAccountId: rule.creditAccountId?.toString() || "",
          remark: rule.remark || "",
        });
      } else {
        setRuleForm({
          startMonth: derivedStart,
          periods: 12,
          method: "monthly",
          debitAccountId: "", creditAccountId: "", remark: "",
        });
      }
    } catch {
      setRuleForm({
        startMonth: derivedStart,
        periods: 12,
        method: "monthly",
        debitAccountId: "", creditAccountId: "", remark: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSaveRule = () => {
    if (!selectedFee || !ruleForm.startMonth || !endMonth) return;
    setRuleMutation.mutate({
      feeId: selectedFee.id,
      startMonth: ruleForm.startMonth,
      endMonth: endMonth,
      method: ruleForm.method,
      debitAccountId: ruleForm.debitAccountId ? Number(ruleForm.debitAccountId) : null,
      creditAccountId: ruleForm.creditAccountId ? Number(ruleForm.creditAccountId) : null,
      remark: ruleForm.remark || null,
    });
  };

  const filtered = fees.filter(
    (f) =>
      f.feeCode.toLowerCase().includes(search.toLowerCase()) ||
      f.feeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-rules-title">摊销规则配置</h1>
        <p className="text-muted-foreground text-sm mt-1">根据每条费用的发生日期设置摊销期数和科目</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">费用列表</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索费用..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                data-testid="input-search-rules"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {feesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无费用</p>
              <p className="text-xs mt-1">请先在费用导入页面导入费用数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>费用编号</TableHead>
                    <TableHead>费用名称</TableHead>
                    <TableHead>发生日期</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>规则状态</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fee) => (
                    <TableRow key={fee.id} data-testid={`row-rule-${fee.id}`}>
                      <TableCell className="font-mono text-sm">{fee.feeCode}</TableCell>
                      <TableCell>{fee.feeName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {fee.feeDate || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ¥{Number(fee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {fee.hasRule ? (
                          <Badge variant="default">已配置</Badge>
                        ) : (
                          <Badge variant="secondary">待配置</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={fee.hasRule ? "secondary" : "default"}
                          onClick={() => openRuleDialog(fee)}
                          data-testid={`button-set-rule-${fee.id}`}
                        >
                          {fee.hasRule ? "修改" : "设置"}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              摊销规则 - {selectedFee?.feeName}
            </DialogTitle>
          </DialogHeader>
          {selectedFee && (
            <div className="space-y-1 text-sm text-muted-foreground mb-1">
              <div>费用编号: {selectedFee.feeCode} | 总金额: ¥{Number(selectedFee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                费用发生日期: {selectedFee.feeDate || "未填写"}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>摊销起始月份 *</Label>
                <Input
                  type="month"
                  value={ruleForm.startMonth}
                  onChange={(e) => setRuleForm({ ...ruleForm, startMonth: e.target.value })}
                  data-testid="input-start-month"
                />
                <p className="text-xs text-muted-foreground mt-1">默认取费用发生月份</p>
              </div>
              <div>
                <Label>摊销期数（月） *</Label>
                <Input
                  type="number"
                  min={1}
                  max={360}
                  value={ruleForm.periods}
                  onChange={(e) => setRuleForm({ ...ruleForm, periods: Math.max(1, parseInt(e.target.value) || 1) })}
                  data-testid="input-periods"
                />
              </div>
            </div>
            {ruleForm.startMonth && endMonth && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
                <span className="font-medium">摊销区间:</span>
                <span className="font-mono">{ruleForm.startMonth}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{endMonth}</span>
                <span className="text-muted-foreground">（共 {ruleForm.periods} 期）</span>
                {selectedFee && (
                  <span className="text-muted-foreground ml-auto">
                    每期约 ¥{(Number(selectedFee.totalAmount) / ruleForm.periods).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
            <div>
              <Label>摊销方式</Label>
              <Select
                value={ruleForm.method}
                onValueChange={(v) => setRuleForm({ ...ruleForm, method: v })}
              >
                <SelectTrigger data-testid="select-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">等额按月摊销</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>借方科目</Label>
              <Select
                value={ruleForm.debitAccountId}
                onValueChange={(v) => setRuleForm({ ...ruleForm, debitAccountId: v })}
              >
                <SelectTrigger data-testid="select-debit-account">
                  <SelectValue placeholder="选择借方科目" />
                </SelectTrigger>
                <SelectContent>
                  {debitAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>贷方科目</Label>
              <Select
                value={ruleForm.creditAccountId}
                onValueChange={(v) => setRuleForm({ ...ruleForm, creditAccountId: v })}
              >
                <SelectTrigger data-testid="select-credit-account">
                  <SelectValue placeholder="选择贷方科目" />
                </SelectTrigger>
                <SelectContent>
                  {creditAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={ruleForm.remark}
                onChange={(e) => setRuleForm({ ...ruleForm, remark: e.target.value })}
                data-testid="input-rule-remark"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} data-testid="button-cancel-rule">取消</Button>
            <Button
              onClick={handleSaveRule}
              disabled={setRuleMutation.isPending || !ruleForm.startMonth || ruleForm.periods < 1}
              data-testid="button-save-rule"
            >
              {setRuleMutation.isPending ? "保存中..." : "保存并生成摊销明细"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
