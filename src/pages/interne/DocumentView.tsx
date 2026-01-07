import { useParams, useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDocument, getProducts, getClients, getDepots, upsertDocument, getDB, nextCode, adjustStock, getCurrentUser } from "@/store/localdb";
import { Document, DocumentStatus, DocType } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { generateCertificatePdf } from "@/pdf/warranty";
import { toast } from "@/hooks/use-toast";
import { PaymentManager } from "@/components/PaymentManager";
import { AlertTriangle, ArrowLeft, FileText, Printer } from "lucide-react";

type CertClientType = "revendeur" | "particulier" | "entreprise";

function CertificateSection({ doc }: { doc: Document }) {
  const [certClientType, setCertClientType] = useState<CertClientType>("particulier");
  const [isGenerating, setIsGenerating] = useState(false);
  const products = getProducts();
  const clients = getClients();
  const client = clients.find((c) => c.id === doc.clientId);

  const handleGenerate = async () => {
    if (!client) {
      toast({ title: "Erreur", description: "Aucun client associé à cette facture.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const productTypes = doc.lines
        .map(line => products.find(p => p.id === line.productId)?.name)
        .filter((name, index, self) => name && self.indexOf(name) === index)
        .join(", ") || "";

      const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
      const timestamp = Date.now();
      const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;

      const certificate = {
        id: certificateId,
        clientName: client.name,
        clientType: certClientType,
        productTypes,
        quantity: productCount,
        date: new Date(doc.date).toLocaleDateString('fr-FR'),
      };

      // Save certificate to registry
      const certificates = JSON.parse(localStorage.getItem("certificates") || "[]");
      certificates.push({
        ...certificate,
        documentId: doc.id,
        documentCode: doc.code,
        articlesPerCertificate: productCount,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem("certificates", JSON.stringify(certificates));

      await generateCertificatePdf(doc, certificate);

      toast({ 
        title: "Certificat généré", 
        description: `Certificat de garantie ${certificateId} généré avec succès.` 
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast({ 
        title: "Erreur", 
        description: "Une erreur est survenue lors de la génération du certificat.", 
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
            <label className="text-sm font-medium text-green-800">Type de client pour le certificat:</label>
            <Select value={certClientType} onValueChange={(v) => setCertClientType(v as CertClientType)}>
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
          Génère un certificat de garantie pour chaque article de la facture.
        </p>
      </CardContent>
    </Card>
  );
}

function nextType(t: DocType): DocType | null {
  if (t === "DV") return "BC";
  if (t === "BC") return "BL";
  if (t === "BL") return "FA";
  return null;
}

export default function InterneDocumentView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const doc = useMemo(() => getDocument(id!), [id, refreshKey]);
  const products = getProducts();
  const clients = getClients();
  const depots = getDepots();

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Document non trouvé</p>
        <Button variant="link" asChild>
          <Link to="/interne/factures">Retour aux factures internes</Link>
        </Button>
      </div>
    );
  }

  // Only show internal mode documents
  if (doc.mode !== "interne") {
    navigate(`/document/${id}`);
    return null;
  }

  const client = clients.find((c) => c.id === doc.clientId);
  const depot = depots.find((d) => d.id === doc.depotId);

  // Calculate totals - TTC to HT conversion (TVA 20%)
  const { totalHT, totalRemise, totalHTNet, tvaAmount, totalTTC } = useMemo(() => {
    const totalTTCBrut = doc.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const totalRemise = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
    const totalTTCNet = totalTTCBrut - totalRemise;
    
    if (doc.includeTVA) {
      const ht = totalTTCNet / 1.2;
      const tva = totalTTCNet - ht;
      return { 
        totalHT: totalTTCBrut / 1.2, 
        totalRemise: totalRemise / 1.2,
        totalHTNet: ht,
        tvaAmount: tva, 
        totalTTC: totalTTCNet 
      };
    } else {
      return { 
        totalHT: totalTTCBrut, 
        totalRemise,
        totalHTNet: totalTTCNet,
        tvaAmount: 0, 
        totalTTC: totalTTCNet 
      };
    }
  }, [doc.lines, doc.includeTVA]);

  const isTransformed = (): boolean => {
    return getDB().documents.some(d => d.refFromId === doc.id);
  };

  const transform = () => {
    const t = nextType(doc.type);
    if (!t) return;
    
    if (isTransformed()) {
      toast({ title: "Erreur", description: "Ce document a déjà été transformé.", variant: "destructive" });
      return;
    }
    
    const newId = `doc_${Date.now()}`;
    const code = nextCode("interne", t);
    const date = todayISO();
    
    let status: DocumentStatus = "valide";
    if (t === "BC") status = "commande";
    if (t === "BL") status = "livre";
    if (t === "FA") status = "facture";
    
    const newDoc: Document = { ...doc, id: newId, code, type: t, date, status, refFromId: doc.id, includeInAccounting: false };
    upsertDocument(newDoc);

    const updatedOriginal = { ...doc, status };
    upsertDocument(updatedOriginal);

    // Stock movement on BL - internal docs still affect stock
    if (t === "BL" && doc.depotId) {
      for (const l of doc.lines) {
        adjustStock(doc.depotId, l.productId, -l.qty);
      }
    }

    toast({ title: `Transformé en ${t}`, description: `Document ${newDoc.code} créé.` });
    navigate(`/interne/document/${newId}`);
  };

  const createBR = () => {
    const newId = `doc_${Date.now()}`;
    const code = nextCode("interne", "BR");
    const date = todayISO();
    const br: Document = { ...doc, id: newId, code, type: "BR", date, status: "valide", refFromId: doc.id, includeInAccounting: false };
    upsertDocument(br);
    if (doc.depotId) {
      for (const l of doc.lines) adjustStock(doc.depotId, l.productId, l.qty);
    }
    toast({ title: "Bon de retour créé", description: br.code });
    navigate(`/interne/document/${newId}`);
  };

  const toggleTVA = () => {
    const updated = { ...doc, includeTVA: !doc.includeTVA };
    upsertDocument(updated);
    setRefreshKey((k) => k + 1);
    toast({ title: doc.includeTVA ? "TVA désactivée" : "TVA activée" });
  };

  const handlePaymentUpdate = () => {
    setRefreshKey((k) => k + 1);
  };

  const transformed = isTransformed();

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
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/interne/${doc.type === "FA" ? "factures" : doc.type === "BL" ? "bl" : doc.type === "BC" ? "bc" : doc.type === "BR" ? "br" : "devis"}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-3">
          <p className="text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            Document interne - Non déclaré en comptabilité mais inclus dans les statistiques.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>{doc.code}</CardTitle>
            <Badge variant={statusVariant(doc.status)}>{statusLabel(doc.status)}</Badge>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Interne
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {nextType(doc.type) && !transformed && (
              <Button onClick={transform}>Transformer → {nextType(doc.type)}</Button>
            )}
            {(doc.type === "BL" || doc.type === "FA") && !transformed && (
              <Button variant="outline" onClick={createBR}>Créer BR</Button>
            )}
            <Button variant="outline" onClick={() => generateDocumentPdf(doc).catch(console.error)}>
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p>{new Date(doc.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p>{client?.name || "-"}</p>
              {client?.code && <p className="text-xs text-muted-foreground">{client.code}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dépôt</p>
              <p>{depot?.name || "-"}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Inclure TVA (20%):</p>
              <Switch checked={doc.includeTVA || false} onCheckedChange={toggleTVA} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Manager for invoices */}
      {doc.type === "FA" && (
        <PaymentManager document={doc} />
      )}

      {/* Certificate Section for invoices */}
      {doc.type === "FA" && <CertificateSection doc={doc} />}

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
                <TableHead className="text-center">Qté</TableHead>
                <TableHead className="text-right">PU HT</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.lines.map((l) => {
                const p = products.find((x) => x.id === l.productId);
                const htUnit = doc.includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
                const totalLine = htUnit * l.qty;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{p?.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p?.imageDataUrl && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <img src={p.imageDataUrl} alt={l.description} className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80" />
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <img src={p.imageDataUrl} alt={l.description} className="w-full h-auto rounded-lg" />
                            </DialogContent>
                          </Dialog>
                        )}
                        <span>{l.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{l.qty}</TableCell>
                    <TableCell className="text-right">{fmtMAD(htUnit)}</TableCell>
                    <TableCell className="text-right">{fmtMAD(totalLine)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">Total H.T (HR)</TableCell>
                <TableCell className="text-right">{fmtMAD(totalHT)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">Remise H.T</TableCell>
                <TableCell className="text-right">{fmtMAD(totalRemise)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">Total H.T (NET)</TableCell>
                <TableCell className="text-right">{fmtMAD(totalHTNet)}</TableCell>
              </TableRow>
              {doc.includeTVA && (
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">T.V.A (20%)</TableCell>
                  <TableCell className="text-right">{fmtMAD(tvaAmount)}</TableCell>
                </TableRow>
              )}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={4} className="text-right font-bold">NET A PAYER T.T.C</TableCell>
                <TableCell className="text-right font-bold">{fmtMAD(totalTTC)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
