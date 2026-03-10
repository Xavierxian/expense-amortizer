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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Search } from "lucide-react";
import type { Fee, Account, AmortizationRule } from "@shared/schema";

export default function RulesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [search, setSearch] = useState("");
  const [ruleForm, setRuleForm] = useState({
    startMonth: "", endMonth: "", method: "monthly",
    debitAccountId: "", creditAccountId: "", remark: "",
  });

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
        description: `已生成 ${data.entriesCount} 条摊销明细`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "设置失败", description: e.message, variant: "destructive" });
    },
  });

  const openRuleDialog = async (fee: Fee) => {
    setSelectedFee(fee);
    try {
      const res = await fetch(`/api/rules/${fee.id}`);
      const rule: AmortizationRule | null = await res.json();
      if (rule) {
        setRuleForm({
          startMonth: rule.startMonth,
          endMonth: rule.endMonth,
          method: rule.method,
          debitAccountId: rule.debitAccountId?.toString() || "",
          creditAccountId: rule.creditAccountId?.toString() || "",
          remark: rule.remark || "",
        });
      } else {
        setRuleForm({
          startMonth: "", endMonth: "", method: "monthly",
          debitAccountId: "", creditAccountId: "", remark: "",
        });
      }
    } catch {
      setRuleForm({
        startMonth: "", endMonth: "", method: "monthly",
        debitAccountId: "", creditAccountId: "", remark: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSaveRule = () => {
    if (!selectedFee) return;
    setRuleMutation.mutate({
      feeId: selectedFee.id,
      startMonth: ruleForm.startMonth,
      endMonth: ruleForm.endMonth,
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
        <p className="text-muted-foreground text-sm mt-1">为每条费用设置摊销期间、方式和科目</p>
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
            <div className="text-sm text-muted-foreground mb-2">
              费用编号: {selectedFee.feeCode} | 总金额: ¥{Number(selectedFee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>摊销开始月份 *</Label>
                <Input
                  type="month"
                  value={ruleForm.startMonth}
                  onChange={(e) => setRuleForm({ ...ruleForm, startMonth: e.target.value })}
                  data-testid="input-start-month"
                />
              </div>
              <div>
                <Label>摊销结束月份 *</Label>
                <Input
                  type="month"
                  value={ruleForm.endMonth}
                  onChange={(e) => setRuleForm({ ...ruleForm, endMonth: e.target.value })}
                  data-testid="input-end-month"
                />
              </div>
            </div>
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
                  <SelectItem value="daily">按天摊销</SelectItem>
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
              disabled={setRuleMutation.isPending || !ruleForm.startMonth || !ruleForm.endMonth}
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
