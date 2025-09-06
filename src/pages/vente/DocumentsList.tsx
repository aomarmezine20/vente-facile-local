import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClients, getDB, getDepots, getDocuments, getProducts, nextCode, upsertDocument, adjustStock } from "@/store/localdb";
import { Document, DocType, Mode } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { toast } from "@/hooks/use-toast";

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

  const transform = (doc: Document) => {
    const t = nextType(doc.type);
    if (!t) return;
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, t);
    const date = todayISO();
    const newDoc: Document = { ...doc, id, code, type: t, date, status: "valide", refFromId: doc.id };
    upsertDocument(newDoc);

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
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => {
                const total = computeTotal(d);
                const client = d.clientId ? clients.find((c) => c.id === d.clientId)?.name : d.vendorName || "-";
                const depot = d.depotId ? depots.find((x) => x.id === d.depotId)?.name : "-";
                return (
                  <TableRow key={d.id}>
                    <TableCell>{d.code}</TableCell>
                    <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                    <TableCell>{client}</TableCell>
                    <TableCell>{depot}</TableCell>
                    <TableCell>{fmtMAD(total)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/document/${d.id}`}>Voir</Link>
                      </Button>
                      {nextType(d.type) && (
                        <Button size="sm" onClick={() => transform(d)}>
                          Transformer → {nextType(d.type)}
                        </Button>
                      )}
                      {mode === "vente" && d.type === "BL" && (
                        <Button variant="outline" size="sm" onClick={() => createBRFromBL(d)}>
                          Créer BR
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => generateDocumentPdf(d)}>
                        PDF
                      </Button>
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
