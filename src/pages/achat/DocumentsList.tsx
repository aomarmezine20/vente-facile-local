import { useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getDocuments, getClients, getDepots, getDB, nextCode, upsertDocument, adjustStock, deleteDocument, getCurrentUser } from "@/store/localdb";
import { DocType, Document, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";

const typeLabels: Record<DocType, string> = {
  DV: "Devis",
  BC: "Bon de commande",
  BL: "Bon de livraison",
  BR: "Bon de retour",
  FA: "Facture",
};

function nextType(t: DocType): DocType | null {
  if (t === "DV") return "BC";
  if (t === "BC") return "BL";
  if (t === "BL") return "FA";
  return null;
}

export default function AchatDocumentsList({ type: propType }: { type?: DocType } = {}) {
  const navigate = useNavigate();
  const { type } = useParams<{ type: DocType }>();
  const actualType = (propType as DocType) || (type as DocType) || "DV";
  const documents = useMemo(() => getDocuments({ mode: "achat", type: actualType }), [actualType, getDB().documents.length]);
  const clients = getClients();
  const depots = getDepots();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

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

    // Stock movement on BL for purchases (add to stock)
    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        adjustStock(doc.depotId, l.productId, l.qty);
      }
    }

    toast({ title: `Transformé en ${t}`, description: `Document ${newDoc.code} créé.` });
    navigate(`/document/${newDoc.id}`);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {typeLabels[actualType]} — Achats
        </h1>
        {actualType === "DV" && (
          <Button asChild>
            <Link to="/achats/devis/nouveau">Nouveau devis</Link>
          </Button>
        )}
      </div>

      <SearchBar />

      <Card>
        <CardHeader>
          <CardTitle>Liste des documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const total = doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
                const depot = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";
                const transformed = isTransformed(doc.id);
                
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.code}</TableCell>
                    <TableCell>{new Date(doc.date).toLocaleDateString()}</TableCell>
                    <TableCell>{doc.vendorName || "-"}</TableCell>
                    <TableCell>{depot}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(doc.status)}>
                        {statusLabel(doc.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{fmtMAD(total)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/document/${doc.id}`}>Voir</Link>
                      </Button>
                      {nextType(doc.type) && !transformed && (
                        <Button size="sm" onClick={() => transform(doc)}>
                          Transformer → {nextType(doc.type)}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => generateDocumentPdf(doc)}>
                        PDF
                      </Button>
                      {isAdmin && !transformed && (
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {documents.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              Aucun document trouvé.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}