import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { adjustStock, getClients, getDepots, getDocument, getProducts, nextCode, upsertDocument, getDocuments } from "@/store/localdb";
import { Document, DocType, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { generateWarrantyCertificate } from "@/pdf/warranty";
import { toast } from "@/hooks/use-toast";
import { PaymentManager } from "@/components/PaymentManager";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

  // Check if document has already been transformed
  const hasBeenTransformed = getDocuments().some(d => d.refFromId === doc.id);
  const canTransform = nextType(doc.type) && !hasBeenTransformed;

  const transform = (doc: Document) => {
    const t = nextType(doc.type);
    if (!t || hasBeenTransformed) return;
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, t);
    const date = todayISO();
    
    let status: DocumentStatus = "valide";
    if (t === "BC") status = "commande";
    if (t === "BL") status = "livre";
    if (t === "FA") status = "facture";
    
    const newDoc: Document = { 
      ...doc, 
      id, 
      code, 
      type: t, 
      date, 
      status, 
      refFromId: doc.id,
      // Default to include in accounting for factures
      includeInAccounting: t === "FA" ? true : undefined
    };
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
        <div className="flex items-center space-x-2">
          <Badge variant={doc.status === "comptabilise" ? "default" : "secondary"}>
            {doc.status === "comptabilise" ? "Comptabilisée" : 
             doc.status === "livre" ? "Livrée" :
             doc.status === "commande" ? "Commandée" : 
             doc.status === "facture" ? "Facturée" :
             doc.status === "valide" ? "Validée" : "Brouillon"}
          </Badge>
          
          {canTransform && (
            <Button onClick={() => transform(doc)}>
              {doc.type === "DV" ? "Transformer → BC" :
               doc.type === "BC" ? "Transformer → BL" :
               doc.type === "BL" ? "Transformer → FA" : "Transformer"}
            </Button>
          )}
          
          {hasBeenTransformed && doc.type !== "FA" && (
            <Badge variant="outline">Déjà transformé</Badge>
          )}
          
          {(doc.type === "BL" || doc.type === "FA") && doc.mode === "vente" && (
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
          {doc.type === "FA" && doc.mode === "vente" && doc.clientId && (
            <div className="md:col-span-3 flex items-center space-x-2">
              <Checkbox 
                id="includeInAccounting"
                checked={doc.includeInAccounting ?? true}
                onCheckedChange={(checked) => {
                  upsertDocument({ ...doc, includeInAccounting: checked === true });
                  toast({ 
                    title: checked ? "Inclure en comptabilité" : "Exclure de la comptabilité",
                    description: checked 
                      ? "Cette facture sera incluse dans les rapports comptables"
                      : "Cette facture sera exclue des rapports comptables"
                  });
                }}
              />
              <Label htmlFor="includeInAccounting" className="text-sm cursor-pointer">
                Inclure cette facture en comptabilité
                <span className="block text-xs text-muted-foreground">
                  {clients.find(c => c.id === doc.clientId)?.type === "particulier" 
                    ? "Pour les particuliers qui demandent une facture officielle"
                    : "Pour toutes les factures entreprises"}
                </span>
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {doc.type === "FA" && doc.mode === "vente" && (
        <PaymentManager document={doc} />
      )}

      {doc.type === "FA" && doc.mode === "vente" && (
        <Card>
          <CardHeader>
            <CardTitle>Certificat de garantie</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => generateWarrantyCertificate(doc)} variant="outline">
              Générer le certificat de garantie
            </Button>
          </CardContent>
        </Card>
      )}

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
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.imageDataUrl && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <img src={p.imageDataUrl} alt={l.description} className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <img src={p.imageDataUrl} alt={l.description} className="w-full h-auto rounded-lg" />
                              <div className="text-center mt-2">
                                <h3 className="font-semibold">{p.name}</h3>
                                <p className="text-sm text-muted-foreground">Référence: {p.sku}</p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <div>
                          <div className="font-medium">{l.description}</div>
                          <div className="text-sm text-muted-foreground">Réf: {p.sku}</div>
                        </div>
                      </div>
                    </TableCell>
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
