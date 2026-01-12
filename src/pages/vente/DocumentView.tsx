import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { adjustStock, getClients, getDepots, getDocument, getProducts, nextCode, upsertDocument, getDocuments, getCurrentUser, deleteDocument } from "@/store/localdb";
import { Document, DocType, DocumentStatus } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { generateCertificatePdf } from "@/pdf/warranty";
import { toast } from "@/hooks/use-toast";
import { PaymentManager } from "@/components/PaymentManager";
import { Label } from "@/components/ui/label";
import { FileText, Printer, ArrowLeft, Trash2 } from "lucide-react";

function nextType(t: DocType): DocType | null {
  if (t === "DV") return "BC";
  if (t === "BC") return "BL";
  if (t === "BL") return "FA";
  return null;
}

// Certificate Section Component with green design
function CertificateSection({ doc, clients, products }: { doc: Document; clients: any[]; products: any[] }) {
  const [clientType, setClientType] = useState<"revendeur" | "particulier" | "entreprise">("particulier");
  const [isGenerating, setIsGenerating] = useState(false);

  if (doc.type !== "FA") return null;

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
      
      toast({ 
        title: `${newCertificates.length} certificat(s) généré(s)`, 
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
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <FileText className="h-5 w-5" />
          Certificats de garantie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium text-green-800">Type de client pour le certificat:</Label>
            <Select value={clientType} onValueChange={(v: any) => setClientType(v)}>
              <SelectTrigger className="mt-1">
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
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-green-600 hover:bg-green-700"
          >
            <Printer className="mr-2 h-4 w-4" />
            {isGenerating ? "Génération..." : "Générer les certificats"}
          </Button>
        </div>
        <p className="text-sm text-green-700">
          {clientType === "revendeur" 
            ? `${totalQty} certificat(s) seront générés (1 par article)`
            : `1 certificat sera généré pour ${totalQty} article(s)`}
        </p>
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
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

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

  // Redirect interne documents to the interne view
  if (doc.mode === "interne") {
    navigate(`/interne/document/${id}`, { replace: true });
    return null;
  }

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
      includeInAccounting: t === "FA" ? true : undefined,
      // TVA always active for factures
      includeTVA: t === "FA" ? true : doc.includeTVA
    };
    upsertDocument(newDoc);

    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        // vente and interne both reduce stock, only achat adds stock
        const delta = doc.mode === "achat" ? l.qty : -l.qty;
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
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/ventes/${doc.type === "FA" ? "factures" : doc.type === "BL" ? "bl" : doc.type === "BC" ? "bc" : doc.type === "BR" ? "br" : "devis"}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
      </div>

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
          {isAdmin && !hasBeenTransformed && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer le document {doc.code} ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      deleteDocument(doc.id);
                      toast({ title: "Document supprimé", description: `Le document ${doc.code} a été supprimé.` });
                      navigate(`/${doc.mode}s/${doc.type === "FA" ? "factures" : doc.type === "BL" ? "bl" : doc.type === "BC" ? "bc" : "devis"}`);
                    }}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p>{new Date(doc.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{doc.mode === "vente" ? "Client" : "Fournisseur"}</p>
              <p>{client}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dépôt</p>
              <p>{depot}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Inclure TVA (20%):</p>
              <Switch 
                checked={doc.includeTVA || false} 
                onCheckedChange={(checked) => {
                  upsertDocument({ ...doc, includeTVA: checked });
                  toast({ 
                    title: checked ? "TVA activée" : "TVA désactivée"
                  });
                }} 
              />
            </div>
          </div>
          {doc.type === "FA" && doc.mode === "vente" && doc.clientId && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <p className="text-sm text-muted-foreground">Inclure en comptabilité:</p>
              <Switch 
                checked={doc.includeInAccounting ?? true} 
                onCheckedChange={(checked) => {
                  upsertDocument({ ...doc, includeInAccounting: checked });
                  toast({ 
                    title: checked ? "Inclure en comptabilité" : "Exclure de la comptabilité"
                  });
                }} 
              />
            </div>
          )}
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
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-primary">Réf.</TableHead>
                <TableHead className="text-primary">Désignation</TableHead>
                <TableHead className="text-primary">Qté</TableHead>
                <TableHead className="text-primary">PU HT</TableHead>
                <TableHead className="text-primary">Total HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const priceHT = l.unitPrice / 1.2;
                const remiseHT = (l.remiseAmount || 0) / 1.2;
                const totalLineHT = (priceHT - remiseHT) * l.qty;
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{l.qty}</TableCell>
                    <TableCell>{fmtMAD(priceHT)}</TableCell>
                    <TableCell>{fmtMAD(totalLineHT)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {/* Styled Totals Section */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-end">
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between py-2 px-4 bg-muted/30 rounded">
                  <span className="text-muted-foreground font-medium">Total H.T (HR)</span>
                  <span className="font-semibold">{fmtMAD(totalHT + (doc.lines.reduce((s, l) => s + (l.remiseAmount || 0) / 1.2 * l.qty, 0)))}</span>
                </div>
                <div className="flex justify-between py-2 px-4">
                  <span className="text-muted-foreground font-medium">Remise H.T</span>
                  <span>{fmtMAD(doc.lines.reduce((s, l) => s + (l.remiseAmount || 0) / 1.2 * l.qty, 0))}</span>
                </div>
                <div className="flex justify-between py-2 px-4 bg-muted/30 rounded">
                  <span className="text-muted-foreground font-medium">Total H.T (NET)</span>
                  <span className="font-semibold">{fmtMAD(totalHT)}</span>
                </div>
                {doc.includeTVA && (
                  <div className="flex justify-between py-2 px-4">
                    <span className="text-muted-foreground font-medium">T.V.A (20%)</span>
                    <span>{fmtMAD(tvaAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 px-4 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="font-bold text-primary">NET A PAYER {doc.includeTVA ? "T.T.C" : "H.T"}</span>
                  <span className="font-bold text-primary">{fmtMAD(doc.includeTVA ? totalTTC : totalHT)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
