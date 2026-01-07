import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getDepots, getProducts, getStock, adjustStock, upsertDepot, getCurrentUser, deleteDepot } from "@/store/localdb";
import { Depot, Product } from "@/types";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Warehouse, Package } from "lucide-react";

export default function DepotManager() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [depots, setDepots] = useState<Depot[]>(getDepots());
  const [products] = useState<Product[]>(getProducts());
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  const [newDepotName, setNewDepotName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Admin-only access
  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard");
      toast.error("Accès réservé aux administrateurs");
    }
  }, [user, navigate]);

  if (user?.role !== "admin") return null;

  const handleAddDepot = () => {
    if (!newDepotName.trim()) {
      toast.error("Le nom du dépôt est requis");
      return;
    }
    const d: Depot = { id: `d_${Date.now()}`, name: newDepotName.trim() };
    upsertDepot(d);
    setDepots(getDepots());
    setNewDepotName("");
    setShowAddDialog(false);
    toast.success(`Dépôt "${d.name}" créé avec succès`);
  };

  const handleUpdateDepot = (depot: Depot) => {
    upsertDepot(depot);
    setDepots(getDepots());
    setEditingDepot(null);
    toast.success(`Dépôt "${depot.name}" mis à jour`);
  };

  const handleDeleteDepot = (depot: Depot) => {
    const stock = getStock().filter(s => s.depotId === depot.id);
    if (stock.length > 0) {
      toast.error("Impossible de supprimer un dépôt contenant du stock");
      return;
    }
    if (confirm(`Voulez-vous vraiment supprimer le dépôt "${depot.name}" ?`)) {
      deleteDepot(depot.id);
      setDepots(getDepots());
      toast.success(`Dépôt "${depot.name}" supprimé`);
    }
  };

  const stock = getStock();

  // Get stock count per depot
  const getDepotStock = (depotId: string) => {
    return stock.filter(s => s.depotId === depotId);
  };

  const getTotalQty = (depotId: string) => {
    return stock.filter(s => s.depotId === depotId).reduce((sum, s) => sum + s.qty, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Warehouse className="h-6 w-6" />
          Gestion des dépôts
        </h1>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau dépôt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau dépôt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Nom du dépôt</label>
                <Input
                  value={newDepotName}
                  onChange={(e) => setNewDepotName(e.target.value)}
                  placeholder="Ex: Dépôt Central, Showroom..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
                <Button onClick={handleAddDepot}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Depots List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des dépôts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du dépôt</TableHead>
                <TableHead>Nb. Articles</TableHead>
                <TableHead>Qté totale</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depots.map((depot) => (
                <TableRow key={depot.id}>
                  <TableCell>
                    {editingDepot?.id === depot.id ? (
                      <Input
                        value={editingDepot.name}
                        onChange={(e) => setEditingDepot({ ...editingDepot, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateDepot(editingDepot);
                          if (e.key === "Escape") setEditingDepot(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{depot.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getDepotStock(depot.id).length}</TableCell>
                  <TableCell>{getTotalQty(depot.id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingDepot?.id === depot.id ? (
                        <>
                          <Button size="sm" onClick={() => handleUpdateDepot(editingDepot)}>Sauvegarder</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDepot(null)}>Annuler</Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setEditingDepot(depot)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteDepot(depot)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {depots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun dépôt créé. Cliquez sur "Nouveau dépôt" pour commencer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock by Depot */}
      {depots.map((depot) => {
        const depotStock = getDepotStock(depot.id);
        if (depotStock.length === 0) return null;

        return (
          <Card key={depot.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock - {depot.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Ajuster</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depotStock.map((s) => {
                    const prod = products.find(p => p.id === s.productId);
                    return (
                      <TableRow key={`${s.depotId}-${s.productId}`}>
                        <TableCell>{prod?.sku || "-"}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {prod?.imageDataUrl && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <img src={prod.imageDataUrl} alt={prod.name} className="h-10 w-10 rounded object-cover cursor-pointer hover:opacity-80" />
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <img src={prod.imageDataUrl} alt={prod.name} className="w-full h-auto rounded-lg" />
                              </DialogContent>
                            </Dialog>
                          )}
                          <span>{prod?.name || "-"}</span>
                        </TableCell>
                        <TableCell className="font-medium">{s.qty}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="+/-"
                              className="w-20"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const input = e.target as HTMLInputElement;
                                  const delta = parseInt(input.value);
                                  if (delta && delta !== 0) {
                                    adjustStock(s.depotId, s.productId, delta);
                                    toast.success(`Stock ajusté: ${delta > 0 ? "+" : ""}${delta}`);
                                    input.value = "";
                                    window.location.reload();
                                  }
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const delta = parseInt(input.value);
                                if (delta && delta !== 0) {
                                  adjustStock(s.depotId, s.productId, delta);
                                  toast.success(`Stock ajusté: ${delta > 0 ? "+" : ""}${delta}`);
                                  input.value = "";
                                  window.location.reload();
                                }
                              }}
                            >
                              OK
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
