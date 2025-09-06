import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adjustStock, getClients, getDepots, getDocument, getProducts, nextCode, upsertDocument } from "@/store/localdb";
import { Document, DocType } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { toast } from "@/hooks/use-toast";

function nextType(t: DocType): DocType | null {
  if (t === "DV") return "BC";
  if (t === "BC") return "BL";
  if (t === "BL") return "FA";
  return null;
}

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = getDocument(id!);
  const products = getProducts();
  const clients = getClients();
  const depots = getDepots();

  const total = useMemo(
    () => doc?.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0) ?? 0,
    [doc?.lines],
  );

  if (!doc) return <div>Document introuvable.</div>;

  const transform = (doc: Document) => {
    const t = nextType(doc.type);
    if (!t) return;
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, t);
    const date = todayISO();
    const newDoc: Document = { ...doc, id, code, type: t, date, status: "valide", refFromId: doc.id };
    upsertDocument(newDoc);

    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        const delta = doc.mode === "vente" ? -l.qty : l.qty;
        adjustStock(doc.depotId, l.productId, delta);
      }
    }

    toast({ title: `Transformé en ${t}`, description: newDoc.code });
    navigate(`/document/${newDoc.id}`);
  };

  const createBR = (doc: Document) => {
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

  const markCompta = () => {
    if (doc.type !== "FA") return;
    upsertDocument({ ...doc, status: "comptabilise" });
    toast({ title: "Facture comptabilisée", description: doc.code });
    navigate(0);
  };

  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId)?.name : doc.vendorName || "-";
  const depot = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {doc.type} — {doc.code}
        </h1>
        <div className="space-x-2">
          {nextType(doc.type) && (
            <Button onClick={() => transform(doc)}>Transformer → {nextType(doc.type)}</Button>
          )}
          {doc.type === "BL" && doc.mode === "vente" && (
            <Button variant="secondary" onClick={() => createBR(doc)}>
              Créer BR
            </Button>
          )}
          {doc.type === "FA" && doc.status !== "comptabilise" && (
            <Button variant="outline" onClick={markCompta}>
              Marquer comptabilisée
            </Button>
          )}
          <Button variant="outline" onClick={() => generateDocumentPdf(doc)}>
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Date</div>
            <div>{new Date(doc.date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{doc.mode === "vente" ? "Client" : "Fournisseur"}</div>
            <div>{client}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Dépôt</div>
            <div>{depot}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>PU</TableHead>
                <TableHead>Remise</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const totalLine = (l.unitPrice - l.remiseAmount) * l.qty;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell>{l.description}</TableCell>
                    <TableCell>{l.qty}</TableCell>
                    <TableCell>{fmtMAD(l.unitPrice)}</TableCell>
                    <TableCell>{fmtMAD(l.remiseAmount)}</TableCell>
                    <TableCell>{fmtMAD(totalLine)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 text-right text-lg font-semibold">Total: {fmtMAD(total)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
