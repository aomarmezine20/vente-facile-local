import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { getDB, getCurrentUser } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";
import { FileText, ShoppingCart, Truck, Receipt, Warehouse, TrendingUp, AlertTriangle, Users, Package } from "lucide-react";

export default function Dashboard() {
  const user = getCurrentUser();
  if (user?.role !== "admin") return <Navigate to="/ventes/devis" replace />;
  const db = getDB();
  
  // Stock analytics
  const totalStock = db.stock.reduce((sum, s) => sum + s.qty, 0);
  const lowStockItems = db.stock.filter(s => s.qty < 5).length;
  const outOfStockItems = db.stock.filter(s => s.qty === 0).length;
  
  // Sales analytics
  const ventes = db.documents.filter((d) => d.mode === "vente");
  const achats = db.documents.filter((d) => d.mode === "achat");
  
  const totalVentesMAD = ventes
    .filter((d) => d.type === "FA")
    .reduce((sum, d) => sum + d.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0), 0);
  
  const totalAchatsMAD = achats
    .filter((d) => d.type === "FA")
    .reduce((sum, d) => sum + d.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0), 0);
    
  const facturesEnAttente = ventes.filter((d) => d.type === "BL").length;
  const devisEnCours = ventes.filter((d) => d.type === "DV").length;
  const commandesEnCours = ventes.filter((d) => d.type === "BC").length;
  
  // Client analytics
  const clientsComptoir = db.clients.filter(c => c.type === "comptoir").length;
  const clientsWeb = db.clients.filter(c => c.type === "web").length;
  
  // Performance metrics
  const tauxTransformation = devisEnCours > 0 ? ((commandesEnCours / devisEnCours) * 100).toFixed(1) : "0";
  const margeEstimee = totalVentesMAD - totalAchatsMAD;

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

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmtMAD(totalVentesMAD)}</div>
            <p className="text-xs text-muted-foreground">Ventes facturées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge estimée</CardTitle>
            <Receipt className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{fmtMAD(margeEstimee)}</div>
            <p className="text-xs text-muted-foreground">Ventes - Achats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux transformation</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{tauxTransformation}%</div>
            <p className="text-xs text-muted-foreground">Devis → Commandes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock critique</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Articles &lt; 5 unités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ruptures stock</CardTitle>
            <Package className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockItems}</div>
            <p className="text-xs text-muted-foreground">Articles épuisés</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devis en cours</CardTitle>
            <FileText className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devisEnCours}</div>
            <p className="text-xs text-muted-foreground">À transformer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BL à facturer</CardTitle>
            <Truck className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{facturesEnAttente}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients comptoir</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsComptoir}</div>
            <p className="text-xs text-muted-foreground">Vente directe</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients web</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsWeb}</div>
            <p className="text-xs text-muted-foreground">Vente en ligne</p>
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
