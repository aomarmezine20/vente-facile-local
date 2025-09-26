import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Product } from "@/types";
import { fmtMAD } from "@/utils/format";

interface ProductGridProps {
  products: Product[];
  onProductSelect?: (product: Product) => void;
  searchable?: boolean;
}

export default function ProductGrid({ products, onProductSelect, searchable = true }: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = searchable 
    ? products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="max-w-sm">
          <Input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <Card 
            key={product.id} 
            className={`cursor-pointer hover:shadow-md transition-shadow ${onProductSelect ? 'hover:bg-accent' : ''}`}
            onClick={() => onProductSelect?.(product)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {product.imageDataUrl && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                        <img 
                          src={product.imageDataUrl} 
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{product.name}</DialogTitle>
                      </DialogHeader>
                      <img 
                        src={product.imageDataUrl} 
                        alt={product.name}
                        className="w-full h-auto rounded-lg"
                      />
                      <div className="space-y-2">
                        <p><strong>Référence:</strong> {product.sku}</p>
                        <p><strong>Prix:</strong> {fmtMAD(product.price)}</p>
                        <p><strong>Catégorie:</strong> {product.category || "Non spécifiée"}</p>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                {!product.imageDataUrl && (
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">Pas d'image</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
                    <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                      {product.sku}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      {fmtMAD(product.price)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {product.category || "Général"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Aucun produit trouvé.
        </div>
      )}
    </div>
  );
}