import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, Navigate } from "react-router-dom";
import { getDB, getCurrentUser } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";
import { FileText, ShoppingCart, Truck, Receipt, Warehouse, TrendingUp, AlertTriangle, Users, Package, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { SearchBar } from "@/components/SearchBar";

export default function Dashboard() {
  const user = getCurrentUser();
  if (user?.role !== "admin") return <Navigate to="/ventes/devis" replace />;
  
  const db = getDB();
  const [timeFilter, setTimeFilter] = useState<"month" | "quarter" | "year" | "all">("month");
  
  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeFilter) {
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setFullYear(2000); // Show all data
    }
    
    return { startDate, endDate: now };
  };

  const { startDate, endDate } = getDateRange();
  
  // Filter documents by date range
  const filteredDocuments = useMemo(() => {
    return db.documents.filter(doc => {
      const docDate = new Date(doc.date);
      return docDate >= startDate && docDate <= endDate;
    });
  }, [db.documents, timeFilter]);
  
  // Stock analytics
  const totalStock = db.stock.reduce((sum, s) => sum + s.qty, 0);
  const lowStockItems = db.stock.filter(s => s.qty < 5 && s.qty > 0).length;
  const outOfStockItems = db.stock.filter(s => s.qty === 0).length;
  
  // Sales analytics (filtered by time)
  const ventes = filteredDocuments.filter((d) => d.mode === "vente");
  const achats = filteredDocuments.filter((d) => d.mode === "achat");
  
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
  const clientsComptoir = db.clients.filter(c => c.type === "particulier").length;
  const clientsWeb = db.clients.filter(c => c.type === "entreprise").length;
  
  // Performance metrics
  const tauxTransformation = devisEnCours > 0 ? ((commandesEnCours / devisEnCours) * 100).toFixed(1) : "0";
  const margeEstimee = totalVentesMAD - totalAchatsMAD;

  // Chart data preparation
  const monthlyData = useMemo(() => {
    const data = [];
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - (11 - i));
      monthStart.setDate(1);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      
      const monthDocs = db.documents.filter(doc => {
        const docDate = new Date(doc.date);
        return docDate >= monthStart && docDate <= monthEnd;
      });
      
      const ventes = monthDocs.filter(d => d.mode === "vente" && d.type === "FA")
        .reduce((sum, d) => sum + d.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0), 0);
      
      const achats = monthDocs.filter(d => d.mode === "achat" && d.type === "FA")
        .reduce((sum, d) => sum + d.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0), 0);
      
      data.push({
        month: months[monthStart.getMonth()],
        ventes,
        achats,
        marge: ventes - achats
      });
    }
    
    return data;
  }, [db.documents]);

  const statusData = [
    { name: "Devis", value: devisEnCours, color: "#8884d8" },
    { name: "Commandes", value: commandesEnCours, color: "#82ca9d" },
    { name: "BL à facturer", value: facturesEnAttente, color: "#ffc658" },
  ];

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "month": return "Dernier mois";
      case "quarter": return "Dernier trimestre";
      case "year": return "Dernière année";
      default: return "Toutes périodes";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité</p>
        </div>
        
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <Select value={timeFilter} onValueChange={(v: "month" | "quarter" | "year" | "all") => setTimeFilter(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Dernier mois</SelectItem>
                <SelectItem value="quarter">Dernier trimestre</SelectItem>
                <SelectItem value="year">Dernière année</SelectItem>
                <SelectItem value="all">Toutes périodes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/ventes/devis/nouveau">Nouveau devis (Vente)</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/achats/devis/nouveau">Nouveau devis (Achat)</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchBar />
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmtMAD(totalVentesMAD)}</div>
            <p className="text-xs text-green-600">{getTimeFilterLabel()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Marge estimée</CardTitle>
            <Receipt className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fmtMAD(margeEstimee)}</div>
            <p className="text-xs text-blue-600">Ventes - Achats</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Taux transformation</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{tauxTransformation}%</div>
            <p className="text-xs text-purple-600">Devis → Commandes</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Stock critique</CardTitle>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{lowStockItems}</div>
            <p className="text-xs text-orange-600">Articles &lt; 5 unités</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Ruptures stock</CardTitle>
            <Package className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{outOfStockItems}</div>
            <p className="text-xs text-red-600">Articles épuisés</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Évolution mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                ventes: { label: "Ventes", color: "hsl(var(--primary))" },
                achats: { label: "Achats", color: "hsl(var(--secondary))" },
                marge: { label: "Marge", color: "hsl(var(--accent))" }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="ventes" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="marge" stroke="hsl(var(--accent))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des documents</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                devis: { label: "Devis", color: "#8884d8" },
                commandes: { label: "Commandes", color: "#82ca9d" },
                factures: { label: "BL à facturer", color: "#ffc658" }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
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
            <CardTitle className="text-sm font-medium">Clients particuliers</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsComptoir}</div>
            <p className="text-xs text-muted-foreground">Personnes physiques</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients entreprises</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsWeb}</div>
            <p className="text-xs text-muted-foreground">Personnes morales</p>
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
            <Button variant="outline" asChild>
              <Link to="/stock">Gestion des stocks</Link>
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