import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getDepots, getProducts, getStock, adjustStock, getCurrentUser, getDB, setDB } from "@/store/localdb";
import { toast } from "@/hooks/use-toast";
import { ArrowRightLeft, Package, Warehouse, History, Plus, Trash2 } from "lucide-react";
import { fmtMAD } from "@/utils/format";

interface TransferLine {
  id: string;
  productId: string;
  qty: number;
}

interface TransferRecord {
  id: string;
  date: string;
  fromDepotId: string;
  toDepotId: string;
  lines: TransferLine[];
  userId?: string;
  userName?: string;
}

export default function StockTransfer() {
  const currentUser = getCurrentUser();
  const isAllowed = currentUser?.role === "admin" || currentUser?.role === "sales";
  
  const depots = getDepots();
  const products = getProducts();
  const stock = getStock();
  
  const [fromDepotId, setFromDepotId] = useState<string>("");
  const [toDepotId, setToDepotId] = useState<string>("");
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [newLine, setNewLine] = useState<{ productId: string; qty: number }>({ productId: "", qty: 1 });
  const [showHistory, setShowHistory] = useState(false);

  // Get transfer history from localStorage
  const transfers = useMemo(() => {
    const stored = localStorage.getItem("stock-transfers");
    return stored ? JSON.parse(stored) as TransferRecord[] : [];
  }, [showHistory]);

  // Get available stock for selected source depot
  const getAvailableStock = (productId: string) => {
    if (!fromDepotId) return 0;
    return stock.find(s => s.productId === productId && s.depotId === fromDepotId)?.qty || 0;
  };

  // Filter products that have stock in source depot
  const availableProducts = useMemo(() => {
    if (!fromDepotId) return [];
    return products.filter(p => {
      const qty = stock.find(s => s.productId === p.id && s.depotId === fromDepotId)?.qty || 0;
      return qty > 0;
    });
  }, [fromDepotId, products, stock]);

  const addLine = () => {
    if (!newLine.productId || newLine.qty <= 0) {
      toast({ title: "Erreur", description: "Sélectionnez un produit et une quantité valide.", variant: "destructive" });
      return;
    }

    const available = getAvailableStock(newLine.productId);
    if (newLine.qty > available) {
      toast({ 
        title: "Stock insuffisant", 
        description: `Stock disponible: ${available}. Quantité demandée: ${newLine.qty}`,
        variant: "destructive" 
      });
      return;
    }

    // Check if product already in lines
    const existing = lines.find(l => l.productId === newLine.productId);
    if (existing) {
      const newTotal = existing.qty + newLine.qty;
      if (newTotal > available) {
        toast({ 
          title: "Stock insuffisant", 
          description: `Stock disponible: ${available}. Total demandé: ${newTotal}`,
          variant: "destructive" 
        });
        return;
      }
      setLines(lines.map(l => l.productId === newLine.productId ? { ...l, qty: newTotal } : l));
    } else {
      setLines([...lines, { id: `tl_${Date.now()}`, productId: newLine.productId, qty: newLine.qty }]);
    }
    
    setNewLine({ productId: "", qty: 1 });
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const executeTransfer = () => {
    if (!fromDepotId || !toDepotId) {
      toast({ title: "Erreur", description: "Sélectionnez les dépôts source et destination.", variant: "destructive" });
      return;
    }

    if (fromDepotId === toDepotId) {
      toast({ title: "Erreur", description: "Les dépôts source et destination doivent être différents.", variant: "destructive" });
      return;
    }

    if (lines.length === 0) {
      toast({ title: "Erreur", description: "Ajoutez au moins un article à transférer.", variant: "destructive" });
      return;
    }

    // Validate all stock availability
    for (const line of lines) {
      const available = getAvailableStock(line.productId);
      if (line.qty > available) {
        const product = products.find(p => p.id === line.productId);
        toast({ 
          title: "Stock insuffisant", 
          description: `${product?.name}: disponible ${available}, demandé ${line.qty}`,
          variant: "destructive" 
        });
        return;
      }
    }

    // Execute transfer
    for (const line of lines) {
      adjustStock(fromDepotId, line.productId, -line.qty); // Remove from source
      adjustStock(toDepotId, line.productId, line.qty);    // Add to destination
    }

    // Save transfer record
    const record: TransferRecord = {
      id: `tr_${Date.now()}`,
      date: new Date().toISOString(),
      fromDepotId,
      toDepotId,
      lines: [...lines],
      userId: currentUser?.id,
      userName: currentUser?.username
    };

    const existingTransfers = JSON.parse(localStorage.getItem("stock-transfers") || "[]");
    localStorage.setItem("stock-transfers", JSON.stringify([record, ...existingTransfers]));

    toast({ 
      title: "Transfert effectué", 
      description: `${lines.length} article(s) transféré(s) avec succès.` 
    });

    // Reset form
    setLines([]);
    setFromDepotId("");
    setToDepotId("");
  };

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl font-medium text-muted-foreground">Accès refusé</p>
        <p className="text-sm text-muted-foreground">Seuls les utilisateurs admin et vente peuvent accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Transfert de stock</h1>
        </div>
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              Historique
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Historique des transferts</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Vers</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Utilisateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucun transfert enregistré
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((t) => {
                    const fromDepot = depots.find(d => d.id === t.fromDepotId)?.name || "Inconnu";
                    const toDepot = depots.find(d => d.id === t.toDepotId)?.name || "Inconnu";
                    const totalQty = t.lines.reduce((s, l) => s + l.qty, 0);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.date).toLocaleString()}</TableCell>
                        <TableCell>{fromDepot}</TableCell>
                        <TableCell>{toDepot}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{totalQty} unité(s)</Badge>
                        </TableCell>
                        <TableCell>{t.userName || "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>

      {/* Depot Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Sélection des dépôts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">Dépôt source</label>
              <Select value={fromDepotId} onValueChange={(v) => { setFromDepotId(v); setLines([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le dépôt source" />
                </SelectTrigger>
                <SelectContent>
                  {depots.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Dépôt destination</label>
              <Select value={toDepotId} onValueChange={setToDepotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le dépôt destination" />
                </SelectTrigger>
                <SelectContent>
                  {depots.filter(d => d.id !== fromDepotId).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Products */}
      {fromDepotId && toDepotId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Articles à transférer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Produit</label>
                <Select value={newLine.productId} onValueChange={(v) => setNewLine({ ...newLine, productId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => {
                      const qty = getAvailableStock(p.id);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{p.sku} — {p.name}</span>
                            <Badge variant="outline">Stock: {qty}</Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantité</label>
                <Input 
                  type="number" 
                  min={1} 
                  value={newLine.qty} 
                  onChange={(e) => setNewLine({ ...newLine, qty: parseInt(e.target.value) || 1 })}
                />
              </div>
              <Button onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>

            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-center">Quantité</TableHead>
                    <TableHead className="text-center">Stock source</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const product = products.find(p => p.id === l.productId);
                    const available = getAvailableStock(l.productId);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>{product?.sku}</TableCell>
                        <TableCell>{product?.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge>{l.qty}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={available >= l.qty ? "secondary" : "destructive"}>
                            {available}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeLine(l.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {lines.length > 0 && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={executeTransfer} size="lg">
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Exécuter le transfert ({lines.reduce((s, l) => s + l.qty, 0)} unité(s))
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Stock Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Aperçu du stock par dépôt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {depots.map((depot) => {
              const depotStock = stock.filter(s => s.depotId === depot.id && s.qty > 0);
              const totalItems = depotStock.reduce((s, item) => s + item.qty, 0);
              return (
                <Card key={depot.id} className="border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4" />
                        {depot.name}
                      </span>
                      <Badge>{totalItems} unité(s)</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    {depotStock.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun stock</p>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {depotStock.slice(0, 5).map((s) => {
                          const product = products.find(p => p.id === s.productId);
                          return (
                            <div key={s.productId} className="flex justify-between text-sm">
                              <span className="truncate">{product?.name}</span>
                              <Badge variant="outline" className="ml-2">{s.qty}</Badge>
                            </div>
                          );
                        })}
                        {depotStock.length > 5 && (
                          <p className="text-xs text-muted-foreground">+{depotStock.length - 5} autres produits</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}