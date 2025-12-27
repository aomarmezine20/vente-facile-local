import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClients, getDB, getDepots, getDocuments, getProducts, nextCode, upsertDocument, adjustStock, deleteDocument, getCurrentUser } from "@/store/localdb";
import { Document, DocType, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { toast } from "@/hooks/use-toast";
import { Trash2, Calendar, AlertTriangle } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";

function computeTotal(doc: Document) {
  return doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
}

function nextType(t: DocType): DocType | null {
  if (t === "DV") return "BC";
  if (t === "BC") return "BL";
  if (t === "BL") return "FA";
  return null;
}

export default function InterneDocumentsList({ type }: { type: DocType }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const docs = useMemo(() => {
    let filtered = getDocuments({ mode: "interne", type });
    
    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.code.toLowerCase().includes(term) ||
        getClients().find(c => c.id === doc.clientId)?.name.toLowerCase().includes(term) ||
        doc.vendorName?.toLowerCase().includes(term)
      );
    }
    
    // Filter by date
    if (dateFrom) {
      filtered = filtered.filter(doc => doc.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(doc => doc.date <= dateTo + "T23:59:59");
    }
    
    // Sort by date descending (recent first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [type, getDB().documents.length, searchTerm, dateFrom, dateTo]);
  
  const products = getProducts();
  const clients = getClients();
  const depots = getDepots();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  
  const statusVariant = (status: string) => {
    switch (status) {
      case "comptabilise": return "default";
      case "facture": return "secondary";
      case "livre": return "secondary";
      case "commande": return "outline";
      case "valide": return "outline";
      default: return "destructive";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "comptabilise": return "Comptabilisée";
      case "facture": return "Facturée";
      case "livre": return "Livrée";
      case "commande": return "Commandée";
      case "valide": return "Validée";
      default: return "Brouillon";
    }
  };

  const isTransformed = (docId: string): boolean => {
    return getDB().documents.some(d => d.refFromId === docId);
  };

  const transform = (doc: Document) => {
    const t = nextType(doc.type);
    if (!t) return;
    
    // Check if already transformed
    if (isTransformed(doc.id)) {
      toast({ title: "Erreur", description: "Ce document a déjà été transformé.", variant: "destructive" });
      return;
    }
    
    const id = `doc_${Date.now()}`;
    const code = nextCode("interne", t);
    const date = todayISO();
    
    // Set appropriate status based on type
    let status: DocumentStatus = "valide";
    if (t === "BC") status = "commande";
    if (t === "BL") status = "livre";
    if (t === "FA") status = "facture";
    
    const newDoc: Document = { ...doc, id, code, type: t, date, status, refFromId: doc.id, includeInAccounting: false };
    upsertDocument(newDoc);

    // Update original document status
    const updatedOriginal = { ...doc, status };
    upsertDocument(updatedOriginal);

    // Stock movement on BL - internal docs still affect stock
    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        adjustStock(doc.depotId, l.productId, -l.qty);
      }
    }

    toast({ title: `Transformé en ${t}`, description: `Document ${newDoc.code} créé.` });
    navigate(`/document/${newDoc.id}`);
  };

  const createBRFromBL = (doc: Document) => {
    const id = `doc_${Date.now()}`;
    const code = nextCode("interne", "BR");
    const date = todayISO();
    const br: Document = { ...doc, id, code, type: "BR", date, status: "valide", refFromId: doc.id, includeInAccounting: false };
    upsertDocument(br);
    if (doc.depotId) {
      for (const l of doc.lines) adjustStock(doc.depotId, l.productId, l.qty);
    }
    toast({ title: "Bon de retour créé", description: br.code });
    navigate(`/document/${br.id}`);
  };

  const handleDelete = (doc: Document) => {
    if (!isAdmin) {
      toast({ title: "Erreur", description: "Seul l'administrateur peut supprimer des documents.", variant: "destructive" });
      return;
    }
    
    if (isTransformed(doc.id)) {
      toast({ title: "Erreur", description: "Impossible de supprimer un document déjà transformé.", variant: "destructive" });
      return;
    }
    
    deleteDocument(doc.id);
    toast({ title: "Document supprimé", description: `Le document ${doc.code} a été supprimé.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Documents Internes — {type}</h1>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Non déclarés
          </Badge>
        </div>
        {type === "DV" && (
          <Button asChild>
            <Link to="/interne/devis/nouveau">Nouveau devis interne</Link>
          </Button>
        )}
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-3">
          <p className="text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Ces documents ne sont pas déclarés en comptabilité mais sont inclus dans les statistiques et affectent les stocks.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recherche & Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchInput 
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher par code ou client..."
          />
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Du:</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Au:</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Effacer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const total = computeTotal(d);
                const client = d.clientId ? clients.find((c) => c.id === d.clientId)?.name : d.vendorName || "-";
                const depot = d.depotId ? depots.find((x) => x.id === d.depotId)?.name : "-";
                const transformed = isTransformed(d.id);
                
                return (
                  <TableRow key={d.id}>
                    <TableCell>{d.code}</TableCell>
                    <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                    <TableCell>{client}</TableCell>
                    <TableCell>{depot}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status)}>
                        {statusLabel(d.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{fmtMAD(total)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/document/${d.id}`}>Voir</Link>
                      </Button>
                      {nextType(d.type) && !transformed && (
                        <Button size="sm" onClick={() => transform(d)}>
                          Transformer → {nextType(d.type)}
                        </Button>
                      )}
                      {d.type === "BL" && !transformed && (
                        <Button variant="outline" size="sm" onClick={() => createBRFromBL(d)}>
                          Créer BR
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => generateDocumentPdf(d).catch(console.error)}>
                        PDF
                      </Button>
                      {isAdmin && !transformed && (
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(d)}>
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