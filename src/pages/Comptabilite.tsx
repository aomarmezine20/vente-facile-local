import { useState, useMemo } from "react";
import { getDocuments, getProducts, getClients, getCompany } from "@/store/localdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Calculator } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Mode, Client } from "@/types";
import { Badge } from "@/components/ui/badge";

export default function Comptabilite() {
  const [mode, setMode] = useState<Mode>("vente");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [clientType, setClientType] = useState<"all" | "entreprise" | "particulier">("all");

  const allDocuments = getDocuments({ mode, type: "FA" });
  const products = getProducts();
  const clients = getClients();
  const company = getCompany();

  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      // Date filter
      if (startDate && doc.date < startDate) return false;
      if (endDate && doc.date > endDate) return false;
      
      // Only include documents marked for accounting (default true)
      if (doc.includeInAccounting === false) return false;
      
      // Client type filter
      if (clientType !== "all" && doc.clientId) {
        const client = clients.find(c => c.id === doc.clientId);
        if (client && client.type !== clientType) return false;
      }
      
      return true;
    });
  }, [allDocuments, startDate, endDate, clientType, clients]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalTax = 0;
    let entrepriseRevenue = 0;
    let particulierRevenue = 0;

    filteredDocuments.forEach((doc) => {
      const docTotal = doc.lines.reduce((sum, line) => {
        return sum + line.qty * (line.unitPrice - line.remiseAmount);
      }, 0);
      
      totalRevenue += docTotal;
      
      // Assume 20% VAT for simplicity
      totalTax += docTotal * 0.20;
      
      if (doc.clientId) {
        const client = clients.find(c => c.id === doc.clientId);
        if (client?.type === "entreprise") {
          entrepriseRevenue += docTotal;
        } else if (client?.type === "particulier") {
          particulierRevenue += docTotal;
        }
      }
    });

    return {
      totalRevenue,
      totalTax,
      entrepriseRevenue,
      particulierRevenue,
      totalWithTax: totalRevenue + totalTax,
    };
  }, [filteredDocuments, clients]);

  const generateComptaPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let startY = 20;
    
    // Company Logo
    if (company.logoDataUrl) {
      try {
        doc.addImage(company.logoDataUrl, "PNG", 15, 10, 25, 25);
        startY = 40;
      } catch {}
    }
    
    // Company info
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(company.name, 45, startY - 15);
    
    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RAPPORT COMPTABLE", pageWidth / 2, startY, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const periodText = `Période: ${startDate ? format(new Date(startDate), "dd/MM/yyyy") : "Début"} - ${endDate ? format(new Date(endDate), "dd/MM/yyyy") : "Fin"}`;
    doc.text(periodText, pageWidth / 2, startY + 8, { align: "center" });
    
    const modeText = `Type: ${mode === "vente" ? "Ventes" : "Achats"}`;
    doc.text(modeText, pageWidth / 2, startY + 15, { align: "center" });
    
    startY += 30;
    
    // Summary Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RÉSUMÉ FINANCIER", 15, startY);
    
    startY += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const summaryData = [
      ["Nombre de factures:", filteredDocuments.length.toString()],
      ["Chiffre d'affaires HT:", `${stats.totalRevenue.toFixed(2)} MAD`],
      ["TVA (20%):", `${stats.totalTax.toFixed(2)} MAD`],
      ["Total TTC:", `${stats.totalWithTax.toFixed(2)} MAD`],
      ["CA Entreprises:", `${stats.entrepriseRevenue.toFixed(2)} MAD`],
      ["CA Particuliers:", `${stats.particulierRevenue.toFixed(2)} MAD`],
    ];
    
    summaryData.forEach(([label, value]) => {
      doc.text(label, 20, startY);
      doc.text(value, 100, startY);
      startY += 7;
    });
    
    startY += 10;
    
    // Documents Table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DÉTAIL DES FACTURES", 15, startY);
    
    startY += 5;
    
    const tableData = filteredDocuments.map((d) => {
      const client = d.clientId ? clients.find(c => c.id === d.clientId) : null;
      const clientName = client?.name || d.vendorName || "-";
      const clientType = client ? (client.type === "entreprise" ? "Entreprise" : "Particulier") : "-";
      
      const total = d.lines.reduce((sum, line) => {
        return sum + line.qty * (line.unitPrice - line.remiseAmount);
      }, 0);
      
      return [
        d.code,
        format(new Date(d.date), "dd/MM/yyyy"),
        clientName,
        clientType,
        `${total.toFixed(2)} MAD`,
      ];
    });
    
    autoTable(doc, {
      startY: startY,
      head: [["N° Facture", "Date", "Client", "Type", "Montant HT"]],
      body: tableData,
      styles: { 
        fontSize: 9,
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [30, 41, 59],
        fontStyle: 'bold'
      },
      theme: 'grid'
    });
    
    // Footer with totals
    const finalY = (doc as any).lastAutoTable.finalY || startY + 50;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total HT: ${stats.totalRevenue.toFixed(2)} MAD`, pageWidth - 15, finalY + 10, { align: "right" });
    doc.text(`TVA: ${stats.totalTax.toFixed(2)} MAD`, pageWidth - 15, finalY + 17, { align: "right" });
    doc.setFontSize(14);
    doc.text(`Total TTC: ${stats.totalWithTax.toFixed(2)} MAD`, pageWidth - 15, finalY + 26, { align: "right" });
    
    // Footer note
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text(`Document généré le ${format(new Date(), "dd/MM/yyyy 'à' HH:mm")}`, 15, footerY);
    doc.text(company.name, pageWidth - 15, footerY, { align: "right" });
    
    doc.save(`rapport-comptable-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Rapport Comptable</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vente">Ventes</SelectItem>
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
              <Label>Type de client</Label>
              <Select value={clientType} onValueChange={(v) => setClientType(v as "all" | "entreprise" | "particulier")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="entreprise">Entreprises</SelectItem>
                  <SelectItem value="particulier">Particuliers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={generateComptaPDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              Générer le rapport PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chiffre d'affaires HT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalRevenue.toFixed(2)} MAD</div>
            <div className="text-sm text-muted-foreground mt-1">
              TVA: {stats.totalTax.toFixed(2)} MAD
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total TTC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.totalWithTax.toFixed(2)} MAD</div>
            <div className="text-sm text-muted-foreground mt-1">
              {filteredDocuments.length} factures
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Entreprises:</span>
              <span className="font-semibold">{stats.entrepriseRevenue.toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Particuliers:</span>
              <span className="font-semibold">{stats.particulierRevenue.toFixed(2)} MAD</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factures comptabilisées</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant HT</TableHead>
                <TableHead className="text-right">TVA</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune facture pour cette période
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => {
                  const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
                  const clientName = client?.name || doc.vendorName || "-";
                  
                  const totalHT = doc.lines.reduce((sum, line) => {
                    return sum + line.qty * (line.unitPrice - line.remiseAmount);
                  }, 0);
                  
                  const tva = totalHT * 0.20;
                  const totalTTC = totalHT + tva;
                  
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.code}</TableCell>
                      <TableCell>{format(new Date(doc.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{clientName}</TableCell>
                      <TableCell>
                        {client ? (
                          <Badge variant={client.type === "entreprise" ? "default" : "secondary"}>
                            {client.type === "entreprise" ? "Entreprise" : "Particulier"}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">{totalHT.toFixed(2)} MAD</TableCell>
                      <TableCell className="text-right">{tva.toFixed(2)} MAD</TableCell>
                      <TableCell className="text-right font-semibold">{totalTTC.toFixed(2)} MAD</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
