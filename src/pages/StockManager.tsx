import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getProducts, getDepots, getStock, adjustStock, deleteStockItem, getCurrentUser, upsertProduct } from "@/store/localdb";
import { toast } from "@/hooks/use-toast";
import { Package, AlertTriangle, TrendingUp, Search, Trash2, Edit } from "lucide-react";
import { Product } from "@/types";
import { fmtMAD } from "@/utils/format";

export default function StockManager() {
  const [refreshKey, setRefreshKey] = useState(0);
  const products = getProducts();
  const depots = getDepots();
  const stock = getStock();
  const user = getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepot, setSelectedDepot] = useState<string>("all");

  // Stock analytics
  const totalItems = stock.reduce((sum, s) => sum + s.qty, 0);
  const lowStockItems = stock.filter(s => s.qty < 5 && s.qty > 0).length;
  const outOfStockItems = stock.filter(s => s.qty === 0).length;
  const inStockItems = stock.filter(s => s.qty > 0).length;

  // Filter stock based on search and depot
  const filteredStock = stock.filter(s => {
    const product = products.find(p => p.id === s.productId);
    const depot = depots.find(d => d.id === s.depotId);
    
    const matchesSearch = !searchQuery || 
      product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      depot?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepot = selectedDepot === "all" || s.depotId === selectedDepot;
    
    return matchesSearch && matchesDepot;
  });

  const handleStockAdjustment = (depotId: string, productId: string, delta: number, reason: string) => {
    if (delta === 0) return;
    
    adjustStock(depotId, productId, delta);
    const product = products.find(p => p.id === productId);
    toast({ 
      title: "Stock ajusté", 
      description: `${delta > 0 ? '+' : ''}${delta} unités pour ${product?.name} (${reason})` 
    });
    setRefreshKey(k => k + 1);
  };

  const handleDeleteStock = (depotId: string, productId: string) => {
    deleteStockItem(depotId, productId);
    const product = products.find(p => p.id === productId);
    const depot = depots.find(d => d.id === depotId);
    toast({ 
      title: "Article supprimé du stock", 
      description: `${product?.name} supprimé du dépôt ${depot?.name}` 
    });
    setRefreshKey(k => k + 1);
  };

  const handleProductUpdate = (product: Product) => {
    upsertProduct(product);
    toast({ 
      title: "Produit modifié", 
      description: `${product.name} a été mis à jour` 
    });
    setRefreshKey(k => k + 1);
  };

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: "Rupture", variant: "destructive" as const, icon: AlertTriangle };
    if (qty < 5) return { label: "Stock faible", variant: "secondary" as const, icon: AlertTriangle };
    return { label: "En stock", variant: "default" as const, icon: Package };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestion des stocks</h1>
        <Badge variant="outline" className="text-sm">
          Utilisateur: {user?.username} ({user?.role})
        </Badge>
      </div>

      {/* Stock Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total articles</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
            <p className="text-xs text-muted-foreground">Unités en stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits en stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inStockItems}</div>
            <p className="text-xs text-muted-foreground">Références disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Références &lt; 5 unités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ruptures</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
            <p className="text-xs text-muted-foreground">Références épuisées</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par réf., nom d'article ou dépôt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedDepot} onValueChange={setSelectedDepot}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les dépôts</SelectItem>
              {depots.map((depot) => (
                <SelectItem key={depot.id} value={depot.id}>
                  {depot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock par article</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Prix TTC</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.map((s) => {
                const product = products.find(p => p.id === s.productId);
                const depot = depots.find(d => d.id === s.depotId);
                const status = getStockStatus(s.qty);
                const StatusIcon = status.icon;

                return (
                  <TableRow key={`${s.depotId}-${s.productId}`}>
                    <TableCell>
                      {product?.imageDataUrl ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <img 
                              src={product.imageDataUrl} 
                              alt={product.name} 
                              className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{product.name}</DialogTitle>
                              <DialogDescription>Référence: {product.sku}</DialogDescription>
                            </DialogHeader>
                            <img src={product.imageDataUrl} alt={product.name} className="w-full h-auto rounded-lg" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product?.sku}</TableCell>
                    <TableCell>{product?.name}</TableCell>
                    <TableCell>{product ? fmtMAD(product.price) : "-"}</TableCell>
                    <TableCell>{depot?.name}</TableCell>
                    <TableCell className="font-bold text-lg">{s.qty}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <StockAdjustmentDialog 
                        productName={product?.name || "Produit"}
                        currentStock={s.qty}
                        onAdjust={(delta, reason) => handleStockAdjustment(s.depotId, s.productId, delta, reason)}
                      />
                      {product && (
                        <ProductEditDialog 
                          product={product}
                          onSave={handleProductUpdate}
                        />
                      )}
                      {isAdmin && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteStock(s.depotId, s.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface StockAdjustmentDialogProps {
  productName: string;
  currentStock: number;
  onAdjust: (delta: number, reason: string) => void;
}

function StockAdjustmentDialog({ productName, currentStock, onAdjust }: StockAdjustmentDialogProps) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (delta === 0) {
      toast({ title: "Erreur", description: "Saisissez une quantité différente de zéro", variant: "destructive" });
      return;
    }

    if (!reason.trim()) {
      toast({ title: "Erreur", description: "Veuillez indiquer une raison", variant: "destructive" });
      return;
    }

    onAdjust(delta, reason);
    setDelta(0);
    setReason("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Ajuster</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustement de stock</DialogTitle>
          <DialogDescription>Modifier la quantité en stock pour {productName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Produit</div>
            <div>{productName}</div>
            <div className="text-sm text-muted-foreground">Stock actuel: {currentStock} unités</div>
          </div>
          
          <div>
            <Label>Quantité à ajouter/retirer</Label>
            <Input
              type="number"
              value={delta || ""}
              onChange={(e) => setDelta(Number(e.target.value))}
              placeholder="Ex: +10 ou -5"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Nouveau stock: {currentStock + delta} unités
            </div>
          </div>

          <div>
            <Label>Raison de l'ajustement</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une raison" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inventory">Inventaire physique</SelectItem>
                <SelectItem value="reception">Réception marchandise</SelectItem>
                <SelectItem value="return">Retour client</SelectItem>
                <SelectItem value="damaged">Produit endommagé</SelectItem>
                <SelectItem value="loss">Perte/Vol</SelectItem>
                <SelectItem value="correction">Correction d'erreur</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">
              Confirmer l'ajustement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProductEditDialogProps {
  product: Product;
  onSave: (product: Product) => void;
}

function ProductEditDialog({ product, onSave }: ProductEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(product.price);
  const [category, setCategory] = useState(product.category || "");

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // Reset to current product values when opening
      setName(product.name);
      setSku(product.sku);
      setPrice(product.price);
      setCategory(product.category || "");
    }
    setOpen(isOpen);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Erreur", description: "Le nom est obligatoire", variant: "destructive" });
      return;
    }

    if (!sku.trim()) {
      toast({ title: "Erreur", description: "La référence est obligatoire", variant: "destructive" });
      return;
    }

    if (price <= 0) {
      toast({ title: "Erreur", description: "Le prix doit être supérieur à 0", variant: "destructive" });
      return;
    }

    onSave({
      ...product,
      name: name.trim(),
      sku: sku.trim(),
      price,
      category: category.trim() || undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le produit</DialogTitle>
          <DialogDescription>Modifier les informations du produit {product.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom du produit</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du produit"
            />
          </div>
          
          <div>
            <Label>Référence (SKU)</Label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Référence"
            />
          </div>

          <div>
            <Label>Prix TTC (MAD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price || ""}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="Prix en MAD"
            />
          </div>

          <div>
            <Label>Catégorie</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Catégorie (optionnel)"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}