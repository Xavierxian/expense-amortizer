import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, Trash2, Search, FileSpreadsheet } from "lucide-react";
import type { Fee, InsertFee } from "@shared/schema";

export default function FeesPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertFee>>({
    feeCode: "", feeName: "", totalAmount: "", feeDate: "", sourceRef: "", sourceSystem: "",
  });

  const { data: fees = [], isLoading } = useQuery<Fee[]>({
    queryKey: ["/api/fees"],
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import-fee", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "导入成功",
        description: `共 ${data.total} 条，导入 ${data.imported} 条，跳过 ${data.skipped} 条`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "导入失败", description: e.message, variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<InsertFee>) => {
      const res = await apiRequest("POST", "/api/fees", { ...data, hasRule: false });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddDialogOpen(false);
      setFormData({ feeCode: "", feeName: "", totalAmount: "", feeDate: "", sourceRef: "", sourceSystem: "" });
      toast({ title: "添加成功" });
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
          <p className="text-muted-foreground text-sm mt-1">管理待摊销费用明细</p>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            data-testid="button-import"
          >
            <Upload className="w-4 h-4 mr-1" />
            {importMutation.isPending ? "导入中..." : "导入 Excel/CSV"}
          </Button>
          <Button variant="secondary" onClick={() => setAddDialogOpen(true)} data-testid="button-add-fee">
            <Plus className="w-4 h-4 mr-1" />
            手动添加
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">费用列表</CardTitle>
            <div className="relative w-64">
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
              <p className="text-xs mt-1">请点击上方按钮导入 Excel/CSV 文件或手动添加</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>费用编号</TableHead>
                    <TableHead>费用名称</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>发生日期</TableHead>
                    <TableHead>来源单据号</TableHead>
                    <TableHead>来源系统</TableHead>
                    <TableHead>规则状态</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fee) => (
                    <TableRow key={fee.id} data-testid={`row-fee-${fee.id}`}>
                      <TableCell className="font-mono text-sm">{fee.feeCode}</TableCell>
                      <TableCell>{fee.feeName}</TableCell>
                      <TableCell className="text-right font-mono">
                        ¥{Number(fee.totalAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{fee.feeDate}</TableCell>
                      <TableCell className="text-muted-foreground">{fee.sourceRef || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{fee.sourceSystem || "-"}</TableCell>
                      <TableCell>
                        {fee.hasRule ? (
                          <Badge variant="default" data-testid={`badge-rule-${fee.id}`}>已配置</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-rule-${fee.id}`}>待配置</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(fee.id)}
                          data-testid={`button-delete-fee-${fee.id}`}
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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动添加费用</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>费用编号 *</Label>
              <Input
                value={formData.feeCode || ""}
                onChange={(e) => setFormData({ ...formData, feeCode: e.target.value })}
                data-testid="input-fee-code"
              />
            </div>
            <div>
              <Label>费用名称 *</Label>
              <Input
                value={formData.feeName || ""}
                onChange={(e) => setFormData({ ...formData, feeName: e.target.value })}
                data-testid="input-fee-name"
              />
            </div>
            <div>
              <Label>总金额 *</Label>
              <Input
                type="number"
                value={formData.totalAmount || ""}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                data-testid="input-fee-amount"
              />
            </div>
            <div>
              <Label>费用发生日期</Label>
              <Input
                type="date"
                value={formData.feeDate || ""}
                onChange={(e) => setFormData({ ...formData, feeDate: e.target.value })}
                data-testid="input-fee-date"
              />
            </div>
            <div>
              <Label>来源单据号</Label>
              <Input
                value={formData.sourceRef || ""}
                onChange={(e) => setFormData({ ...formData, sourceRef: e.target.value })}
                data-testid="input-source-ref"
              />
            </div>
            <div>
              <Label>来源系统</Label>
              <Input
                value={formData.sourceSystem || ""}
                onChange={(e) => setFormData({ ...formData, sourceSystem: e.target.value })}
                data-testid="input-source-system"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add">取消</Button>
            <Button
              onClick={() => addMutation.mutate(formData)}
              disabled={addMutation.isPending || !formData.feeCode || !formData.feeName || !formData.totalAmount}
              data-testid="button-confirm-add"
            >
              {addMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
