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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import type { Account, InsertAccount } from "@shared/schema";

export default function AccountsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<InsertAccount>>({
    code: "", name: "", type: "debit",
  });

  const { data: accts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; payload: Partial<InsertAccount> }) => {
      if (data.id) {
        const res = await apiRequest("PUT", `/api/accounts/${data.id}`, data.payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/accounts", data.payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
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
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "删除成功" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setFormData({ code: "", name: "", type: "debit" });
    setDialogOpen(true);
  };

  const openEdit = (acct: Account) => {
    setEditing(acct);
    setFormData({ code: acct.code, name: acct.name, type: acct.type });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-accounts-title">科目管理</h1>
          <p className="text-muted-foreground text-sm mt-1">维护会计科目，在摊销规则中使用</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-account">
          <Plus className="w-4 h-4 mr-1" />
          新增科目
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">科目列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : accts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无科目</p>
              <p className="text-xs mt-1">点击上方按钮添加会计科目</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>科目编码</TableHead>
                  <TableHead>科目名称</TableHead>
                  <TableHead>科目类型</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accts.map((acct) => (
                  <TableRow key={acct.id} data-testid={`row-account-${acct.id}`}>
                    <TableCell className="font-mono">{acct.code}</TableCell>
                    <TableCell>{acct.name}</TableCell>
                    <TableCell>
                      <Badge variant={acct.type === "debit" ? "default" : "secondary"}>
                        {acct.type === "debit" ? "借方" : "贷方"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(acct)}
                          data-testid={`button-edit-account-${acct.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(acct.id)}
                          data-testid={`button-delete-account-${acct.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑科目" : "新增科目"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>科目编码 *</Label>
              <Input
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                data-testid="input-account-code"
              />
            </div>
            <div>
              <Label>科目名称 *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-account-name"
              />
            </div>
            <div>
              <Label>科目类型 *</Label>
              <Select
                value={formData.type || "debit"}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger data-testid="select-account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">借方</SelectItem>
                  <SelectItem value="credit">贷方</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} data-testid="button-cancel-account">取消</Button>
            <Button
              onClick={() =>
                saveMutation.mutate({ id: editing?.id, payload: formData })
              }
              disabled={saveMutation.isPending || !formData.code || !formData.name}
              data-testid="button-save-account"
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
