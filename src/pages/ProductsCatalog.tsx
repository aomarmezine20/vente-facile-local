import { getProducts } from "@/store/localdb";
import ProductGrid from "@/components/ProductGrid";

export default function ProductsCatalog() {
  const products = getProducts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catalogue des Produits</h1>
      </div>
      
      <ProductGrid products={products} />
    </div>
  );
}