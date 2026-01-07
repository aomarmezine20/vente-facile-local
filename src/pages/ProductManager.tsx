import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getProducts, upsertProduct, getDB, setDB, getCurrentUser, getStock, deleteStockItem, getDepots } from "@/store/localdb";
import { Product } from "@/types";
import { fmtMAD } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Image, Search } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";

export default function ProductManager() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "",
    name: "",
    unit: "u",
    price: 0,
    category: "",
    imageDataUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const products = getProducts();
  const stock = getStock();
  const depots = getDepots();

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.sku.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  });

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      unit: "u",
      price: 0,
      category: "",
      imageDataUrl: "",
    });
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      price: product.price,
      category: product.category || "",
      imageDataUrl: product.imageDataUrl || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    if (!isAdmin) {
      toast({ title: "Accès refusé", description: "Seul l'administrateur peut supprimer des produits.", variant: "destructive" });
      return;
    }

    // Delete all stock entries for this product
    depots.forEach((depot) => {
      deleteStockItem(depot.id, product.id);
    });

    // Delete the product
    setDB((db) => {
      db.products = db.products.filter((p) => p.id !== product.id);
    });

    toast({ title: "Produit supprimé", description: `Le produit ${product.name} a été supprimé.` });
    setRefreshKey((k) => k + 1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData((prev) => ({ ...prev, imageDataUrl: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!formData.sku || !formData.name) {
      toast({ title: "Erreur", description: "SKU et nom sont requis.", variant: "destructive" });
      return;
    }

    // Check for duplicate SKU (excluding current product if editing)
    const existingSku = products.find(
      (p) => p.sku === formData.sku && p.id !== editingProduct?.id
    );
    if (existingSku) {
      toast({ title: "Erreur", description: "Ce SKU existe déjà.", variant: "destructive" });
      return;
    }

    const product: Product = {
      id: editingProduct?.id || `prod_${Date.now()}`,
      sku: formData.sku!,
      name: formData.name!,
      unit: formData.unit || "u",
      price: formData.price || 0,
      category: formData.category,
      imageDataUrl: formData.imageDataUrl,
    };

    upsertProduct(product);
    toast({ 
      title: editingProduct ? "Produit modifié" : "Produit ajouté", 
      description: `${product.name} a été ${editingProduct ? "modifié" : "ajouté"}.` 
    });
    
    setDialogOpen(false);
    resetForm();
    setRefreshKey((k) => k + 1);
  };

  const getTotalStock = (productId: string) => {
    return stock.filter((s) => s.productId === productId).reduce((sum, s) => sum + s.qty, 0);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Gestion des Produits</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Seul l'administrateur peut gérer les produits.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gestion des Produits</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Produit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU / Référence *</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="REF-001"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom du produit *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nom du produit"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unité</label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="u, kg, m, etc."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix de vente (MAD)</label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catégorie</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Catégorie"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Image</label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {formData.imageDataUrl ? "Changer l'image" : "Télécharger une image"}
                  </Button>
                </div>
                {formData.imageDataUrl && (
                  <img 
                    src={formData.imageDataUrl} 
                    alt="Preview" 
                    className="h-20 w-20 object-cover rounded mt-2" 
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                {editingProduct ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher par SKU, nom ou catégorie..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Produits ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-center">Stock Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const totalStock = getTotalStock(product.id);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.imageDataUrl ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <img 
                              src={product.imageDataUrl} 
                              alt={product.name} 
                              className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-80" 
                            />
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <img src={product.imageDataUrl} alt={product.name} className="w-full h-auto rounded" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="outline">{product.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">{fmtMAD(product.price)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={totalStock > 0 ? "default" : "destructive"}>
                        {totalStock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucun produit trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
