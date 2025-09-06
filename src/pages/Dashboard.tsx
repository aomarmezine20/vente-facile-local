import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { getDB, getCurrentUser } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";
import { FileText, ShoppingCart, Truck, Receipt, Warehouse } from "lucide-react";

export default function Dashboard() {
  const user = getCurrentUser();
  if (user?.role !== "admin") return <Navigate to="/ventes/devis" replace />;
  const db = getDB();
  const totalStock = db.stock.reduce((sum, s) => sum + s.qty, 0);
  const ventes = db.documents.filter((d) => d.mode === "vente");
  const totalVentesMAD = ventes
    .filter((d) => d.type === "FA")
    .reduce((sum, d) => sum + d.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0), 0);
  const facturesEnAttente = ventes.filter((d) => d.type === "BL").length;

  const statCls = "grid grid-cols-1 gap-4 md:grid-cols-4";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/ventes/devis/nouveau">Nouveau devis (Vente)</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/achats/devis/nouveau">Nouveau devis (Achat)</Link>
          </Button>
        </div>
      </div>

      <div className={statCls}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock total</CardTitle>
            <Warehouse className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground">Unités disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes facturées</CardTitle>
            <Receipt className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtMAD(totalVentesMAD)}</div>
            <p className="text-xs text-muted-foreground">Cumul des factures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BL en attente de facture</CardTitle>
            <Truck className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{facturesEnAttente}</div>
            <p className="text-xs text-muted-foreground">Documents à facturer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{db.documents.length}</div>
            <p className="text-xs text-muted-foreground">Tous types confondus</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/ventes/devis">Devis (Vente)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/ventes/bc">Commandes (BC)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/ventes/bl">Livraisons (BL)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/ventes/factures">Factures (FA)</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin">Administration</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Achats</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/achats/devis">Devis (Achat)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/achats/bc">Commandes</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/achats/bl">Réceptions (BL)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/achats/factures">Factures</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
