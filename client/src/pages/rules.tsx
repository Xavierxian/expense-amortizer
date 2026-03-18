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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import type { RuleTemplate, Account } from "@shared/schema";

export default function RulesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RuleTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "", defaultMonths: 12, method: "monthly",
    debitAccountId: "", creditAccountId: "", remark: "",
  });

  const { data: templates = [], isLoading } = useQuery<RuleTemplate[]>({
    queryKey: ["/api/rule-templates"],
  });

  const { data: accts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const debitAccounts = accts.filter((a) => a.type === "debit");
  const creditAccounts = accts.filter((a) => a.type === "credit");

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; payload: any }) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/rule-templates/${data.id}`, data.payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/rule-templates", data.payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rule-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: "保存成功" });
    },
    onError: (e: Error) => {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rule-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rule-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "删除成功" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setFormData({ name: "", defaultMonths: 12, method: "monthly", debitAccountId: "", creditAccountId: "", remark: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: RuleTemplate) => {
    setEditing(t);
    setFormData({
      name: t.name,
      defaultMonths: t.defaultMonths,
      method: t.method,
      debitAccountId: t.debitAccountId?.toString() || "",
      creditAccountId: t.creditAccountId?.toString() || "",
      remark: t.remark || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: formData.name,
      defaultMonths: formData.defaultMonths,
      method: formData.method,
      debitAccountId: formData.debitAccountId ? Number(formData.debitAccountId) : null,
      creditAccountId: formData.creditAccountId ? Number(formData.creditAccountId) : null,
      remark: formData.remark || null,
    };
    saveMutation.mutate({ id: editing?.id, payload });
  };

  const getAccountName = (id: number | null) => {
    if (!id) return "-";
    const acct = accts.find(a => a.id === id);
    return acct ? `${acct.code} ${acct.name}` : "-";
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-rules-title">摊销规则配置</h1>
          <p className="text-muted-foreground text-sm mt-1">按费用类别定义默认摊销月数和科目，导入费用时自动匹配</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-template">
          <Plus className="w-4 h-4 mr-1" />
          新增规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">规则模板列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无规则模板</p>
              <p className="text-xs mt-1">点击上方按钮添加费用类别的摊销规则</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] whitespace-nowrap">费用类别名称</TableHead>
                    <TableHead className="min-w-[80px] text-center whitespace-nowrap">默认摊销月数</TableHead>
                    <TableHead className="min-w-[160px]">借方科目</TableHead>
                    <TableHead className="min-w-[160px]">贷方科目</TableHead>
                    <TableHead className="min-w-[120px]">备注</TableHead>
                    <TableHead className="min-w-[72px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id} data-testid={`row-template-${t.id}`}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{t.defaultMonths} 个月</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getAccountName(t.debitAccountId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getAccountName(t.creditAccountId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.remark || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-template-${t.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(t.id)} data-testid={`button-delete-template-${t.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
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
            <DialogTitle>{editing ? "编辑规则模板" : "新增规则模板"}</DialogTitle>
            <DialogDescription>
              定义费用类别的默认摊销月数和科目，导入费用时自动匹配名称中包含的关键词
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>费用类别名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：房租、软件许可费、装修费"
                data-testid="input-template-name"
              />
              <p className="text-xs text-muted-foreground mt-1">费用名称中包含此关键词时将自动匹配</p>
            </div>
            <div>
              <Label>默认摊销月数 *</Label>
              <Input
                type="number"
                min={1}
                max={360}
                value={formData.defaultMonths}
                onChange={(e) => setFormData({ ...formData, defaultMonths: Math.max(1, parseInt(e.target.value) || 1) })}
                data-testid="input-default-months"
              />
            </div>
            <div>
              <Label>默认借方科目</Label>
              <Select
                value={formData.debitAccountId}
                onValueChange={(v) => setFormData({ ...formData, debitAccountId: v })}
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
              <Label>默认贷方科目</Label>
              <Select
                value={formData.creditAccountId}
                onValueChange={(v) => setFormData({ ...formData, creditAccountId: v })}
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
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                data-testid="input-template-remark"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} data-testid="button-cancel-template">取消</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !formData.name || formData.defaultMonths < 1}
              data-testid="button-save-template"
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
