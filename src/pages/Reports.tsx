import { useState, useMemo } from "react";
import { getDocuments, getProducts, getClients, getCompany } from "@/store/localdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Mode } from "@/types";

export default function Reports() {
  const [mode, setMode] = useState<Mode | "all">("vente");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [accountingFilter, setAccountingFilter] = useState<"all" | "included" | "excluded">("all");

  // Get documents based on mode filter
  const allDocs = mode === "all" 
    ? [...getDocuments({ mode: "vente", type: "FA" }), ...getDocuments({ mode: "interne", type: "FA" })]
    : getDocuments({ mode: mode as Mode, type: "FA" });
  const products = getProducts();
  const clients = getClients();

  const filteredDocuments = useMemo(() => {
    return allDocs.filter((doc) => {
      if (startDate && doc.date < startDate) return false;
      if (endDate && doc.date > endDate) return false;
      
      // Filter by accounting status
      if (accountingFilter === "included" && doc.includeInAccounting === false) return false;
      if (accountingFilter === "excluded" && doc.includeInAccounting !== false) return false;
      
      return true;
    });
  }, [allDocs, startDate, endDate, accountingFilter]);

  // Calculate correct HT/TVA/TTC for products
  // All prices are TTC, so: HT = TTC / 1.20, TVA = HT * 0.20
  const productStats = useMemo(() => {
    const stats = new Map<string, { name: string; qty: number; revenueHT: number; revenueTTC: number }>();
    
    filteredDocuments.forEach((doc) => {
      doc.lines.forEach((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (!product) return;
        
        // Prices are TTC, remise is TTC
        const priceTTC = line.unitPrice;
        const remiseTTC = line.remiseAmount || 0;
        const netTTC = (priceTTC - remiseTTC) * line.qty;
        
        // Convert to HT: HT = TTC / 1.20
        const netHT = netTTC / 1.20;
        
        const existing = stats.get(line.productId) || { name: product.name, qty: 0, revenueHT: 0, revenueTTC: 0 };
        existing.qty += line.qty;
        existing.revenueHT += netHT;
        existing.revenueTTC += netTTC;
        stats.set(line.productId, existing);
      });
    });

    return Array.from(stats.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [filteredDocuments, products]);

  // Calculate totals with correct TTC->HT conversion
  const totals = useMemo(() => {
    let totalTTC = 0;
    
    filteredDocuments.forEach((doc) => {
      doc.lines.forEach((line) => {
        const priceTTC = line.unitPrice;
        const remiseTTC = line.remiseAmount || 0;
        totalTTC += (priceTTC - remiseTTC) * line.qty;
      });
    });
    
    // TTC / 1.20 = HT, TVA = HT * 0.20
    const totalHT = totalTTC / 1.20;
    const totalTVA = totalHT * 0.20;
    
    return { totalHT, totalTVA, totalTTC };
  }, [filteredDocuments]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const company = getCompany();
    
    // Logo
    let startY = 20;
    if (company.logoDataUrl) {
      try {
        doc.addImage(company.logoDataUrl, "PNG", 15, 10, 25, 25);
        startY = 40;
      } catch {}
    }
    
    // Company info
    doc.setFontSize(14);
    doc.text(company.name, 45, startY - 10);
    
    // Title
    doc.setFontSize(18);
    doc.text(`Rapport ${mode === "vente" ? "Ventes" : "Achats"} - Factures`, pageWidth / 2, startY + 5, { align: "center" });
    
    // Period
    doc.setFontSize(12);
    const periodText = `Période: ${startDate || "Début"} - ${endDate || "Fin"}`;
    doc.text(periodText, pageWidth / 2, startY + 15, { align: "center" });
    
    // Summary
    doc.setFontSize(14);
    doc.text(`Total factures: ${filteredDocuments.length}`, 20, startY + 30);
    doc.text(`Total HT: ${totals.totalHT.toFixed(2)} MAD`, 20, startY + 40);
    doc.text(`TVA 20%: ${totals.totalTVA.toFixed(2)} MAD`, 20, startY + 50);
    doc.text(`Total TTC: ${totals.totalTTC.toFixed(2)} MAD`, 20, startY + 60);
    
    // Documents table
    doc.setFontSize(12);
    doc.text("Liste des factures", 20, startY + 75);
    
    autoTable(doc, {
      startY: startY + 80,
      head: [["Code", "Type", "Date", "Client", "Total HT", "TVA", "Total TTC"]],
      body: filteredDocuments.map((d) => {
        const client = clients.find((c) => c.id === d.clientId);
        let docTTC = 0;
        d.lines.forEach((line) => {
          docTTC += (line.unitPrice - (line.remiseAmount || 0)) * line.qty;
        });
        const docHT = docTTC / 1.20;
        const docTVA = docHT * 0.20;
        
        return [
          d.code,
          d.type,
          format(new Date(d.date), "dd/MM/yyyy"),
          client?.name || d.vendorName || "-",
          docHT.toFixed(2),
          docTVA.toFixed(2),
          docTTC.toFixed(2)
        ];
      }),
    });

    // Product stats table
    const finalY = (doc as any).lastAutoTable.finalY || 75;
    doc.text("Articles les plus vendus", 20, finalY + 15);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [["Article", "Quantité vendue", "Revenu HT", "Revenu TTC"]],
      body: productStats.slice(0, 10).map((p) => [
        p.name,
        p.qty.toString(),
        p.revenueHT.toFixed(2),
        p.revenueTTC.toFixed(2)
      ]),
    });

    doc.save(`rapport-${mode}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rapports {mode === "vente" ? "Ventes" : "Achats"} - Factures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vente">Ventes</SelectItem>
                  <SelectItem value="interne">Docs Interne</SelectItem>
                  <SelectItem value="all">Ventes + Interne</SelectItem>
                  <SelectItem value="achat">Achats</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date début</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Date fin</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Comptabilité</Label>
              <Select value={accountingFilter} onValueChange={(v) => setAccountingFilter(v as "all" | "included" | "excluded")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="included">Incluses</SelectItem>
                  <SelectItem value="excluded">Exclues</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={generatePDF} className="w-full">
                <FileDown className="mr-2 h-4 w-4" />
                Générer PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total factures:</span>
                    <span className="font-bold">{filteredDocuments.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total HT:</span>
                    <span className="font-bold">{totals.totalHT.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVA 20%:</span>
                    <span className="font-bold">{totals.totalTVA.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Total TTC:</span>
                    <span className="font-bold text-primary">{totals.totalTTC.toFixed(2)} MAD</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Articles les plus vendus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {productStats.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span>{idx + 1}. {p.name}</span>
                      <span className="font-medium">{p.qty} unités - {p.revenueTTC.toFixed(2)} MAD TTC</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead className="text-right">TVA</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => {
                const client = clients.find((c) => c.id === doc.clientId);
                let docTTC = 0;
                doc.lines.forEach((line) => {
                  docTTC += (line.unitPrice - (line.remiseAmount || 0)) * line.qty;
                });
                const docHT = docTTC / 1.20;
                const docTVA = docHT * 0.20;
                
                return (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.code}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>{format(new Date(doc.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{client?.name || doc.vendorName || "-"}</TableCell>
                    <TableCell className="text-right">{docHT.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{docTVA.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{docTTC.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statistiques par article</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Article</TableHead>
                <TableHead className="text-right">Quantité vendue</TableHead>
                <TableHead className="text-right">Revenu HT</TableHead>
                <TableHead className="text-right">Revenu TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productStats.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{p.qty}</TableCell>
                  <TableCell className="text-right">{p.revenueHT.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.revenueTTC.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}