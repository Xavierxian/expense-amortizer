import { useState, useRef } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, Trash2, Search, FileSpreadsheet, Settings2, ArrowRight, Download, Zap, RefreshCw } from "lucide-react";
import type { Fee, InsertFee, Account, Entity, RuleTemplate } from "@shared/schema";

function addMonthsFn(yearMonth: string, count: number): string {
  if (!yearMonth || count <= 0) return yearMonth;
  const [y, m] = yearMonth.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + (count - 1);
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^\d{4,6}$/.test(s)) {
    const serial = parseInt(s);
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const slash = s.split("/");
  if (slash.length === 3) {
    let yr = slash[2].trim();
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${slash[0].trim().padStart(2, "0")}-${slash[1].trim().padStart(2, "0")}`;
  }
  return s;
}

function feeeDateToMonth(feeDate: string): string {
  if (!feeDate) return "";
  const normalized = normalizeDate(feeDate);
  const parts = normalized.split("-");
  if (parts.length >= 2 && parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}`;
  return "";
}

export default function FeesPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [amortDialogOpen, setAmortDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [formData, setFormData] = useState<Partial<InsertFee> & { templateId?: string }>({
    entityId: 0, feeCode: "", feeName: "", totalAmount: "", feeDate: "", sourceRef: "", sourceSystem: "", templateId: "",
  });
  const [amortForm, setAmortForm] = useState({
    amortMonths: 12,
    startMonth: "",
    debitAccountId: "",
    creditAccountId: "",
  });

  const { data: entityList = [] } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
  });

  const { data: templates = [] } = useQuery<RuleTemplate[]>({
    queryKey: ["/api/rule-templates"],
  });

  const entityParam = selectedEntityId && selectedEntityId !== "all" ? `?entityId=${selectedEntityId}` : "";
  const { data: fees = [], isLoading } = useQuery<Fee[]>({
    queryKey: ["/api/fees", entityParam],
  });

  const { data: accts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const debitAccounts = accts.filter((a) => a.type === "debit");
  const creditAccounts = accts.filter((a) => a.type === "credit");

  const entityName = (entityId: number) => {
    const e = entityList.find(x => x.id === entityId);
    return e ? e.name : "-";
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import-fee", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "导入失败" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      const extras: string[] = [];
      if (data.newEntities > 0) extras.push(`新增主体 ${data.newEntities} 个`);
      if (data.newTemplates > 0) extras.push(`新增费用类别 ${data.newTemplates} 个`);
      toast({
        title: "导入成功",
        description: `共 ${data.total} 条，导入 ${data.imported} 条，跳过 ${data.skipped} 条${extras.length ? "，" + extras.join("，") : ""}`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "导入失败", description: e.message, variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<InsertFee> & { templateId?: string }) => {
      const { templateId, ...feeData } = data;
      const res = await apiRequest("POST", "/api/fees", {
        ...feeData,
        amortConfigured: false,
        ...(templateId ? { templateId: Number(templateId) } : {}),
      });
      return res.json();
    },
    onSuccess: (fee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      setAddDialogOpen(false);
      setFormData({ entityId: 0, feeCode: "", feeName: "", totalAmount: "", feeDate: "", sourceRef: "", sourceSystem: "", templateId: "" });
      toast({ title: "添加成功", description: fee.amortConfigured ? "已自动生成摊销明细" : "请在列表中配置摊销规则" });
    },
    onError: (e: Error) => {
      toast({ title: "添加失败", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "删除成功" });
    },
  });

  const configureAmortMutation = useMutation({
    mutationFn: async (data: { id: number; amortMonths: number; startMonth: string; debitAccountId: number | null; creditAccountId: number | null }) => {
      const res = await apiRequest("POST", `/api/configure-fee-amort/${data.id}`, {
        amortMonths: data.amortMonths,
        startMonth: data.startMonth,
        debitAccountId: data.debitAccountId,
        creditAccountId: data.creditAccountId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      setAmortDialogOpen(false);
      toast({
        title: "摊销配置成功",
        description: `已生成 ${data.entriesCount} 期摊销明细（${data.startMonth} 至 ${data.endMonth}）`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "配置失败", description: e.message, variant: "destructive" });
    },
  });

  const batchGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/batch-generate-amort", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      toast({
        title: "批量生成完成",
        description: `已为 ${data.processed} 条费用自动生成摊销明细`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "批量生成失败", description: e.message, variant: "destructive" });
    },
  });

  const regenerateAmortMutation = useMutation({
    mutationFn: async (feeId: number) => {
      const res = await apiRequest("POST", `/api/regenerate-fee-amort/${feeId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amort-table"] });
      toast({
        title: "摊销已重新生成",
        description: `已生成 ${data.entriesCount} 期摊销明细`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "重新生成失败", description: e.message, variant: "destructive" });
    },
  });

  const openAmortDialog = (fee: Fee) => {
    setSelectedFee(fee);
    setAmortForm({
      amortMonths: fee.amortMonths || 12,
      startMonth: fee.startMonth || feeeDateToMonth(fee.feeDate),
      debitAccountId: fee.debitAccountId?.toString() || "",
      creditAccountId: fee.creditAccountId?.toString() || "",
    });
    setAmortDialogOpen(true);
  };

  const handleConfirmAmort = () => {
    if (!selectedFee) return;
    configureAmortMutation.mutate({
      id: selectedFee.id,
      amortMonths: amortForm.amortMonths,
      startMonth: amortForm.startMonth,
      debitAccountId: amortForm.debitAccountId ? Number(amortForm.debitAccountId) : null,
      creditAccountId: amortForm.creditAccountId ? Number(amortForm.creditAccountId) : null,
    });
  };

  const selectedEndMonth = amortForm.startMonth && amortForm.amortMonths > 0
    ? addMonthsFn(amortForm.startMonth, amortForm.amortMonths) : "";

  const unconfiguredCount = fees.filter(f => !f.amortConfigured && f.amortMonths && f.startMonth).length;

  const filtered = fees.filter(
    (f) =>
      f.feeCode.toLowerCase().includes(search.toLowerCase()) ||
      f.feeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-fees-title">费用导入</h1>
          <p className="text-muted-foreground text-sm mt-1">导入费用明细，配置每条费用的摊销月数</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
              e.target.value = "";
            }}
            data-testid="input-file-upload"
          />
          <Button
            variant="outline"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/import-template";
              a.download = "fee_import_template.xlsx";
              a.click();
            }}
            data-testid="button-download-template"
          >
            <Download className="w-4 h-4 mr-1" />
            下载模板
          </Button>
          {unconfiguredCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => batchGenerateMutation.mutate()}
              disabled={batchGenerateMutation.isPending}
              data-testid="button-batch-generate"
            >
              <Zap className="w-4 h-4 mr-1" />
              {batchGenerateMutation.isPending ? "生成中..." : `批量生成摊销明细 (${unconfiguredCount})`}
            </Button>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            data-testid="button-import"
          >
            <Upload className="w-4 h-4 mr-1" />
            {importMutation.isPending ? "导入中..." : "导入 Excel/CSV"}
          </Button>
          <Button variant="secondary" onClick={() => {
            setFormData({ entityId: 0, feeCode: "", feeName: "", totalAmount: "", feeDate: "", sourceRef: "", sourceSystem: "", templateId: "" });
            setAddDialogOpen(true);
          }} data-testid="button-add-fee">
            <Plus className="w-4 h-4 mr-1" />
            手动添加
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">费用列表</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger className="w-40" data-testid="select-filter-entity">
                  <SelectValue placeholder="全部主体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部主体</SelectItem>
                  {entityList.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索费用编号或名称..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-fees"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无费用数据</p>
              <p className="text-xs mt-1">请选择主体后导入 Excel/CSV 文件或手动添加</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>费用编号</TableHead>
                    <TableHead>费用名称</TableHead>
                    <TableHead>所属主体</TableHead>
                    <TableHead>承担部门</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>发生日期</TableHead>
                    <TableHead className="text-center">摊销月数</TableHead>
                    <TableHead>摊销区间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fee) => (
                    <TableRow key={fee.id} data-testid={`row-fee-${fee.id}`}>
                      <TableCell className="font-mono text-sm">{fee.feeCode}</TableCell>
                      <TableCell>{fee.feeName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entityName(fee.entityId)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{fee.department || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ¥{Number(fee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{normalizeDate(fee.feeDate)}</TableCell>
                      <TableCell className="text-center">
                        {fee.amortMonths ? (
                          <Badge variant="secondary">{fee.amortMonths} 月</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {fee.startMonth && fee.endMonth ? (
                          <span>{fee.startMonth} ~ {fee.endMonth}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {fee.amortConfigured ? (
                          <Badge variant="default" data-testid={`badge-status-${fee.id}`}>已确认</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-status-${fee.id}`}>待确认</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={fee.amortConfigured ? "secondary" : "default"}
                            onClick={() => openAmortDialog(fee)}
                            data-testid={`button-configure-${fee.id}`}
                          >
                            <Settings2 className="w-3.5 h-3.5 mr-1" />
                            {fee.amortConfigured ? "修改" : "配置"}
                          </Button>
                          {fee.amortConfigured && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => regenerateAmortMutation.mutate(fee.id)}
                              disabled={regenerateAmortMutation.isPending}
                              title="重新生成摊销"
                              data-testid={`button-regenerate-${fee.id}`}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(fee.id)}
                            data-testid={`button-delete-fee-${fee.id}`}
                          >
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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动添加费用</DialogTitle>
            <DialogDescription>填写费用基本信息，选择费用类型后将自动生成摊销明细</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>单号 *</Label>
              <Input value={formData.feeCode || ""} onChange={(e) => setFormData({ ...formData, feeCode: e.target.value })} data-testid="input-fee-code" placeholder="费用单据编号" />
            </div>
            <div>
              <Label>标题 *</Label>
              <Input value={formData.feeName || ""} onChange={(e) => setFormData({ ...formData, feeName: e.target.value })} data-testid="input-fee-name" placeholder="费用名称或摘要" />
            </div>
            <div>
              <Label>支付公司 *</Label>
              <Select
                value={formData.entityId?.toString() || ""}
                onValueChange={(v) => setFormData({ ...formData, entityId: Number(v) })}
              >
                <SelectTrigger data-testid="select-add-entity">
                  <SelectValue placeholder="选择支付公司" />
                </SelectTrigger>
                <SelectContent>
                  {entityList.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>支付日期 *</Label>
              <Input
                type="date"
                value={formData.feeDate || ""}
                onChange={(e) => setFormData({ ...formData, feeDate: e.target.value })}
                data-testid="input-fee-date"
              />
            </div>
            <div>
              <Label>费用类型名称</Label>
              <Select
                value={formData.templateId || ""}
                onValueChange={(v) => {
                  const tmpl = templates.find(t => t.id.toString() === v);
                  setFormData({
                    ...formData,
                    templateId: v,
                    amortMonths: tmpl?.defaultMonths ?? formData.amortMonths,
                  });
                }}
              >
                <SelectTrigger data-testid="select-add-template">
                  <SelectValue placeholder="选择费用类型（可选，选后自动生成摊销明细）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.templateId && formData.templateId !== "none" && formData.feeDate && (() => {
                const tmpl = templates.find(t => t.id.toString() === formData.templateId);
                const months = tmpl?.defaultMonths || 12;
                const start = feeeDateToMonth(formData.feeDate);
                const end = addMonthsFn(start, months);
                return (
                  <p className="text-xs text-muted-foreground mt-1">
                    摊销 {months} 个月，{start} → {end}，自动生成明细
                  </p>
                );
              })()}
            </div>
            <div>
              <Label>金额 *</Label>
              <Input type="number" value={formData.totalAmount || ""} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} data-testid="input-fee-amount" placeholder="0.00" />
            </div>
            <div>
              <Label>消费事由</Label>
              <Input value={formData.sourceRef || ""} onChange={(e) => setFormData({ ...formData, sourceRef: e.target.value })} data-testid="input-source-ref" placeholder="费用说明或用途" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add">取消</Button>
            <Button
              onClick={() => addMutation.mutate(formData)}
              disabled={addMutation.isPending || !formData.entityId || !formData.feeCode || !formData.feeName || !formData.totalAmount || !formData.feeDate}
              data-testid="button-confirm-add"
            >
              {addMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={amortDialogOpen} onOpenChange={setAmortDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>摊销配置 - {selectedFee?.feeName}</DialogTitle>
            <DialogDescription>
              确认或修改该费用的摊销月数和科目，确认后自动从发生日期起生成摊销明细
            </DialogDescription>
          </DialogHeader>
          {selectedFee && (
            <div className="text-sm text-muted-foreground mb-1">
              费用编号: {selectedFee.feeCode} | 总金额: ¥{Number(selectedFee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} | 发生日期: {normalizeDate(selectedFee.feeDate)}
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>摊销开始年月 *</Label>
                <Input
                  type="month"
                  value={amortForm.startMonth}
                  onChange={(e) => setAmortForm({ ...amortForm, startMonth: e.target.value })}
                  data-testid="input-start-month"
                />
                <p className="text-xs text-muted-foreground mt-1">默认取费用发生日期，可修改</p>
              </div>
              <div>
                <Label>摊销月数 *</Label>
                <Input
                  type="number"
                  min={1}
                  max={360}
                  value={amortForm.amortMonths}
                  onChange={(e) => setAmortForm({ ...amortForm, amortMonths: Math.max(1, parseInt(e.target.value) || 1) })}
                  data-testid="input-amort-months"
                />
                <p className="text-xs text-muted-foreground mt-1">从规则模板带入，可修改</p>
              </div>
            </div>
            {amortForm.startMonth && selectedEndMonth && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm flex-wrap">
                <span className="font-medium">摊销区间:</span>
                <span className="font-mono">{amortForm.startMonth}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{selectedEndMonth}</span>
                <span className="text-muted-foreground">（共 {amortForm.amortMonths} 期）</span>
                {selectedFee && (
                  <span className="text-muted-foreground ml-auto">
                    每期约 ¥{(Number(selectedFee.totalAmount) / amortForm.amortMonths).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
            <div>
              <Label>借方科目</Label>
              <Select
                value={amortForm.debitAccountId}
                onValueChange={(v) => setAmortForm({ ...amortForm, debitAccountId: v })}
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
                value={amortForm.creditAccountId}
                onValueChange={(v) => setAmortForm({ ...amortForm, creditAccountId: v })}
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
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAmortDialogOpen(false)} data-testid="button-cancel-amort">取消</Button>
            <Button
              onClick={handleConfirmAmort}
              disabled={configureAmortMutation.isPending || amortForm.amortMonths < 1}
              data-testid="button-confirm-amort"
            >
              {configureAmortMutation.isPending ? "保存中..." : "确认并生成摊销明细"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
