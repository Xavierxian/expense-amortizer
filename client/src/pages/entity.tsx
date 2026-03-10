import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import type { Entity } from "@shared/schema";

export default function EntityPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", remark: "" });

  const { data: entityList = [], isLoading } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; payload: any }) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/entities/${data.id}`, data.payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/entities", data.payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
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
      await apiRequest("DELETE", `/api/entities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "删除成功" });
    },
    onError: (e: Error) => {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setFormData({ code: "", name: "", remark: "" });
    setDialogOpen(true);
  };

  const openEdit = (e: Entity) => {
    setEditing(e);
    setFormData({ code: e.code, name: e.name, remark: e.remark || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      id: editing?.id,
      payload: { code: formData.code, name: formData.name, remark: formData.remark || null },
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-entity-title">主体管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理核算主体，不同主体分别生成摊销表和凭证</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-entity">
          <Plus className="w-4 h-4 mr-1" />
          新增主体
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">主体列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entityList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无主体</p>
              <p className="text-xs mt-1">点击上方按钮添加核算主体</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>主体编码</TableHead>
                    <TableHead>主体名称</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityList.map((e) => (
                    <TableRow key={e.id} data-testid={`row-entity-${e.id}`}>
                      <TableCell className="font-mono">{e.code}</TableCell>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.remark || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(e)} data-testid={`button-edit-entity-${e.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(e.id)} data-testid={`button-delete-entity-${e.id}`}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑主体" : "新增主体"}</DialogTitle>
            <DialogDescription>设置核算主体的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>主体编码 *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="如：E001"
                data-testid="input-entity-code"
              />
            </div>
            <div>
              <Label>主体名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：总公司、华东分公司"
                data-testid="input-entity-name"
              />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                data-testid="input-entity-remark"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} data-testid="button-cancel-entity">取消</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !formData.code || !formData.name}
              data-testid="button-save-entity"
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
