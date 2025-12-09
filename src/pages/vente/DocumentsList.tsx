import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClients, getDB, getDepots, getDocuments, getProducts, nextCode, upsertDocument, adjustStock, deleteDocument, getCurrentUser } from "@/store/localdb";
import { Document, DocType, Mode, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { toast } from "@/hooks/use-toast";
import { Trash2, Search } from "lucide-react";
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

export default function DocumentsList({ mode, type }: { mode: Mode; type: DocType }) {
  const navigate = useNavigate();
  const docs = useMemo(() => getDocuments({ mode, type }), [mode, type, getDB().documents.length]);
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
    const code = nextCode(doc.mode, t);
    const date = todayISO();
    
    // Set appropriate status based on type
    let status: DocumentStatus = "valide";
    if (t === "BC") status = "commande";
    if (t === "BL") status = "livre";
    if (t === "FA") status = "facture";
    
    const newDoc: Document = { ...doc, id, code, type: t, date, status, refFromId: doc.id };
    upsertDocument(newDoc);

    // Update original document status
    const updatedOriginal = { ...doc, status };
    upsertDocument(updatedOriginal);

    // Stock movement on BL
    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        const delta = doc.mode === "vente" ? -l.qty : l.qty;
        adjustStock(doc.depotId, l.productId, delta);
      }
    }

    toast({ title: `Transformé en ${t}`, description: `Document ${newDoc.code} créé.` });
    navigate(`/document/${newDoc.id}`);
  };

  const createBRFromBL = (doc: Document) => {
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, "BR");
    const date = todayISO();
    const br: Document = { ...doc, id, code, type: "BR", date, status: "valide", refFromId: doc.id };
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
        <h1 className="text-xl font-semibold">
          {mode === "vente" ? "Ventes" : "Achats"} — {type}
        </h1>
        {type === "DV" && (
          <Button asChild>
            <Link to={`/${mode}s/devis/nouveau`}>Nouveau devis</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchInput 
            value=""
            onChange={() => {}}
            placeholder="Rechercher par code ou client..."
          />
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
                <TableHead>{mode === "vente" ? "Client" : "Fournisseur"}</TableHead>
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
                      {mode === "vente" && d.type === "BL" && !transformed && (
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
