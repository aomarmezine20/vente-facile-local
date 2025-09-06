import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getDocuments, getClients, getDepots } from "@/store/localdb";
import { DocType } from "@/types";
import { fmtMAD } from "@/utils/format";

const typeLabels: Record<DocType, string> = {
  DV: "Devis",
  BC: "Bon de commande",
  BL: "Bon de livraison",
  BR: "Bon de retour",
  FA: "Facture",
};

export default function AchatDocumentsList() {
  const { type } = useParams<{ type: DocType }>();
  const actualType = (type as DocType) || "DV";
  const documents = getDocuments({ mode: "achat", type: actualType });
  const clients = getClients();
  const depots = getDepots();

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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const total = doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
                const depot = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";
                
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
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/document/${doc.id}`}>Voir</Link>
                      </Button>
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