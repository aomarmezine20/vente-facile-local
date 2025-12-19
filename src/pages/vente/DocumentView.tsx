import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { adjustStock, getClients, getDepots, getDocument, getProducts, nextCode, upsertDocument, getDocuments } from "@/store/localdb";
import { Document, DocType, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { generateCertificatePdf } from "@/pdf/warranty";
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

// Certificate Section Component
function CertificateSection({ doc, clients, products }: { doc: Document; clients: any[]; products: any[] }) {
  const [clientType, setClientType] = useState<"revendeur" | "particulier" | "entreprise">("particulier");
  const [isGenerating, setIsGenerating] = useState(false);

  if (doc.type !== "FA" || doc.mode !== "vente") return null;

  const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
  const productTypes = doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ");
  const totalQty = doc.lines.reduce((sum, line) => sum + line.qty, 0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const storedTemplates = localStorage.getItem("certificateTemplates");
      const templates = storedTemplates ? JSON.parse(storedTemplates) : [];
      const templateUrl = templates.length > 0 ? templates[0].dataUrl : null;

      const existingCerts = JSON.parse(localStorage.getItem("certificates") || "[]");
      const newCertificates: any[] = [];

      if (clientType === "revendeur") {
        // For revendeur: generate 1 certificate per article
        for (let i = 0; i < totalQty; i++) {
          const timestamp = Date.now() + i;
          const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;
          
          const cert = {
            id: certificateId,
            documentId: doc.id,
            documentCode: doc.code,
            clientName: client?.name || "",
            clientType: clientType,
            productTypes: productTypes,
            quantity: 1,
            articlesPerCertificate: 1,
            date: new Date(doc.date).toLocaleDateString('fr-FR'),
            createdAt: new Date().toISOString()
          };

          newCertificates.push(cert);
          await generateCertificatePdf(doc, cert, templateUrl);
        }
      } else {
        // For particulier and entreprise: generate 1 certificate for ALL articles
        const timestamp = Date.now();
        const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;
        
        const cert = {
          id: certificateId,
          documentId: doc.id,
          documentCode: doc.code,
          clientName: client?.name || "",
          clientType: clientType,
          productTypes: productTypes,
          quantity: totalQty,
          articlesPerCertificate: totalQty,
          date: new Date(doc.date).toLocaleDateString('fr-FR'),
          createdAt: new Date().toISOString()
        };

        newCertificates.push(cert);
        await generateCertificatePdf(doc, cert, templateUrl);
      }

      localStorage.setItem("certificates", JSON.stringify([...existingCerts, ...newCertificates]));
      
      const numCertificates = newCertificates.length;
      toast({ 
        title: `${numCertificates} certificat(s) généré(s)`, 
        description: `Type: ${clientType}`,
        duration: 5000
      });
    } catch (error) {
      toast({ 
        title: "Erreur", 
        description: "Impossible de générer le certificat",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificat de garantie</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Type de client</Label>
            <Select value={clientType} onValueChange={(v: any) => setClientType(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revendeur">Revendeur</SelectItem>
                <SelectItem value="particulier">Particulier</SelectItem>
                <SelectItem value="entreprise">Entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Génération..." : "Générer certificat"}
          </Button>
          
          <span className="text-xs text-muted-foreground">
            {clientType === "revendeur" 
              ? `${totalQty} certificat(s) seront générés (1 par article)`
              : `1 certificat sera généré (${totalQty} articles)`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = getDocument(id!);
  const products = getProducts();
  const clients = getClients();
  const depots = getDepots();

  // MANDATORY CALCULATION RULES:
  // 1) All prices entered are TTC, all remises are TTC
  // 2) Convert price TTC to HT: HT_initial = TTC / 1.20
  // 3) Convert remise TTC to HT: Remise_HT = Remise_TTC / 1.20
  // 4) Apply discount on HT: HT_after_discount = (HT_initial - Remise_HT) * qty
  // 5) Calculate TVA on net HT: TVA = HT_after_discount * 0.20
  // 6) Total TTC = HT_after_discount + TVA
  const totalHT = useMemo(
    () => doc?.lines.reduce((s, l) => {
      const priceHT = l.unitPrice / 1.2; // Convert price TTC to HT
      const remiseHT = (l.remiseAmount || 0) / 1.2; // Convert remise TTC to HT
      const lineHT = (priceHT - remiseHT) * l.qty; // Apply discount on HT
      return s + lineHT;
    }, 0) ?? 0,
    [doc?.lines],
  );
  
  const tvaAmount = totalHT * 0.2; // TVA is 20% of net HT (after remise)
  const totalTTC = totalHT + tvaAmount; // Total TTC for payment reference

  if (!doc) return <div>Document introuvable.</div>;

  // Check if document has already been transformed
  const hasBeenTransformed = getDocuments().some(d => d.refFromId === doc.id);
  const canTransform = nextType(doc.type) && !hasBeenTransformed;

  const transform = (doc: Document) => {
    const t = nextType(doc.type);
    if (!t || hasBeenTransformed) return;
    
    // Get client type for document code
    const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
    const clientType = client?.type as "particulier" | "entreprise" | undefined;
    
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, t, clientType);
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
      includeInAccounting: t === "FA" ? true : undefined,
      // TVA always active for factures
      includeTVA: t === "FA" ? true : doc.includeTVA
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
    // Get client type for document code
    const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
    const clientType = client?.type as "particulier" | "entreprise" | undefined;
    
    const id = `doc_${Date.now()}`;
    const code = nextCode(doc.mode, "BR", clientType);
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
          <Button variant="outline" onClick={() => generateDocumentPdf(doc).catch(console.error)}>
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
          {/* TVA checkbox - available for all document types */}
          <div className="md:col-span-3 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeTVA"
                checked={doc.includeTVA ?? false}
                onCheckedChange={(checked) => {
                  upsertDocument({ ...doc, includeTVA: checked === true });
                  toast({ 
                    title: checked ? "TVA incluse" : "TVA exclue",
                    description: checked 
                      ? `TVA 20% sera ajoutée au PDF`
                      : "Le total sera calculé hors taxes"
                  });
                }}
              />
              <Label htmlFor="includeTVA" className="text-sm cursor-pointer">
                Inclure la TVA (20%) dans le PDF
                <span className="block text-xs text-muted-foreground">
                  Afficher le total H.T, TVA et TTC sur le document
                </span>
              </Label>
            </div>
            
            {doc.type === "FA" && doc.mode === "vente" && doc.clientId && (
              <div className="flex items-center space-x-2">
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
          </div>
        </CardContent>
      </Card>

      {doc.type === "FA" && doc.mode === "vente" && (
        <PaymentManager document={doc} />
      )}

      <CertificateSection doc={doc} clients={clients} products={products} />

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
          <div className="mt-4 text-right space-y-1">
            <div className="text-sm text-muted-foreground">Total HT: {fmtMAD(totalHT)}</div>
            {doc.includeTVA && (
              <div className="text-sm text-muted-foreground">TVA 20%: {fmtMAD(tvaAmount)}</div>
            )}
            <div className="text-lg font-semibold">
              Total {doc.includeTVA ? "TTC" : "HT"}: {fmtMAD(doc.includeTVA ? totalTTC : totalHT)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
