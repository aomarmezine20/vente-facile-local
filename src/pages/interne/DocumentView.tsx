import { useParams, useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getDocument, getProducts, getClients, getDepots, upsertDocument, getDB, nextCode, adjustStock, getCurrentUser, deleteDocument, getStock } from "@/store/localdb";
import { Document, DocumentStatus, DocType, DocumentLine } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { generateDocumentPdf } from "@/pdf/pdf";
import { generateCertificatePdf } from "@/pdf/warranty";
import { toast } from "@/hooks/use-toast";
import { PaymentManager } from "@/components/PaymentManager";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { AlertTriangle, ArrowLeft, FileText, Printer, Trash2, Pencil, Plus, X, Save, Check, ChevronsUpDown } from "lucide-react";

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
  const stock = getStock();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editLines, setEditLines] = useState<DocumentLine[]>([]);
  const [newLine, setNewLine] = useState({ productId: "", qty: 1, unitPrice: 0, remiseAmount: 0 });
  const [productOpen, setProductOpen] = useState(false);
  const [editClientId, setEditClientId] = useState<string | undefined>(undefined);
  const [editDepotId, setEditDepotId] = useState<string | undefined>(undefined);

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

  // Edit functions (admin only)
  const startEditing = () => {
    setEditLines([...doc.lines]);
    setEditClientId(doc.clientId);
    setEditDepotId(doc.depotId);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditLines([]);
    setNewLine({ productId: "", qty: 1, unitPrice: 0, remiseAmount: 0 });
    setEditClientId(undefined);
    setEditDepotId(undefined);
    setIsEditing(false);
  };

  const saveEdits = () => {
    if (editLines.length === 0) {
      toast({ title: "Erreur", description: "Le document doit avoir au moins une ligne.", variant: "destructive" });
      return;
    }
    upsertDocument({ 
      ...doc, 
      lines: editLines,
      clientId: editClientId,
      depotId: editDepotId
    });
    toast({ title: "Document modifié", description: `Les modifications ont été enregistrées.` });
    setIsEditing(false);
    setRefreshKey(k => k + 1);
  };

  const updateEditLine = (lineId: string, field: keyof DocumentLine, value: number | string) => {
    setEditLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l));
  };

  const removeEditLine = (lineId: string) => {
    setEditLines(prev => prev.filter(l => l.id !== lineId));
  };

  const addNewLine = () => {
    if (!newLine.productId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un produit.", variant: "destructive" });
      return;
    }
    const product = products.find(p => p.id === newLine.productId);
    if (!product) return;

    const line: DocumentLine = {
      id: `line_${Date.now()}`,
      productId: newLine.productId,
      description: product.name,
      qty: newLine.qty,
      unitPrice: newLine.unitPrice || product.price,
      remiseAmount: newLine.remiseAmount
    };
    setEditLines(prev => [...prev, line]);
    setNewLine({ productId: "", qty: 1, unitPrice: 0, remiseAmount: 0 });
    setProductOpen(false);
  };

  const getProductStock = (productId: string) => {
    if (!doc.depotId) return 0;
    return stock.find(s => s.productId === productId && s.depotId === doc.depotId)?.qty || 0;
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
            {isAdmin && !transformed && !isEditing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="default" size="sm" onClick={saveEdits}>
                  <Save className="h-4 w-4 mr-1" />
                  Enregistrer
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  <X className="h-4 w-4 mr-1" />
                  Annuler
                </Button>
              </>
            )}
            {isAdmin && !transformed && !isEditing && (
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
                        navigate(`/interne/${doc.type === "FA" ? "factures" : doc.type === "BL" ? "bl" : doc.type === "BC" ? "bc" : "devis"}`);
                      }}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
{isEditing ? (
                <SearchableCombobox
                  options={clients.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.code})`,
                    sublabel: c.phone || c.email
                  }))}
                  value={editClientId}
                  onValueChange={setEditClientId}
                  placeholder="Sélectionner un client"
                  searchPlaceholder="Rechercher un client..."
                  emptyMessage="Aucun client trouvé."
                  className="mt-1"
                />
              ) : (
                <>
                  <p>{client?.name || "-"}</p>
                  {client?.code && <p className="text-xs text-muted-foreground">{client.code}</p>}
                </>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dépôt</p>
              {isEditing ? (
                <SearchableCombobox
                  options={depots.map((d) => ({
                    value: d.id,
                    label: d.name
                  }))}
                  value={editDepotId}
                  onValueChange={setEditDepotId}
                  placeholder="Sélectionner un dépôt"
                  searchPlaceholder="Rechercher un dépôt..."
                  emptyMessage="Aucun dépôt trouvé."
                  className="mt-1"
                />
              ) : (
                <p>{depot?.name || "-"}</p>
              )}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes</CardTitle>
          {isEditing && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Mode édition
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-center">Qté</TableHead>
                <TableHead className="text-right">PU TTC</TableHead>
                <TableHead className="text-right">Remise TTC</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                {isEditing && <TableHead className="w-16">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isEditing ? editLines : doc.lines).map((l) => {
                const p = products.find((x) => x.id === l.productId);
                const htUnit = doc.includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
                const remiseHT = doc.includeTVA ? (l.remiseAmount || 0) / 1.2 : (l.remiseAmount || 0);
                const totalLine = (htUnit - remiseHT) * l.qty;
                
                if (isEditing) {
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{p?.sku || "-"}</TableCell>
                      <TableCell>{l.description}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={l.qty}
                          onChange={(e) => updateEditLine(l.id, "qty", parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => updateEditLine(l.id, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.remiseAmount}
                          onChange={(e) => updateEditLine(l.id, "remiseAmount", parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right">{fmtMAD(totalLine)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditLine(l.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }
                
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
                    <TableCell className="text-right">{fmtMAD(l.unitPrice)}</TableCell>
                    <TableCell className="text-right">{fmtMAD(l.remiseAmount)}</TableCell>
                    <TableCell className="text-right">{fmtMAD(totalLine)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isEditing ? 5 : 5} className="text-right font-medium">Total H.T (HR)</TableCell>
                <TableCell className="text-right">{fmtMAD(totalHT)}</TableCell>
                {isEditing && <TableCell />}
              </TableRow>
              <TableRow>
                <TableCell colSpan={isEditing ? 5 : 5} className="text-right font-medium">Remise H.T</TableCell>
                <TableCell className="text-right">{fmtMAD(totalRemise)}</TableCell>
                {isEditing && <TableCell />}
              </TableRow>
              <TableRow>
                <TableCell colSpan={isEditing ? 5 : 5} className="text-right font-medium">Total H.T (NET)</TableCell>
                <TableCell className="text-right">{fmtMAD(totalHTNet)}</TableCell>
                {isEditing && <TableCell />}
              </TableRow>
              {doc.includeTVA && (
                <TableRow>
                  <TableCell colSpan={isEditing ? 5 : 5} className="text-right font-medium">T.V.A (20%)</TableCell>
                  <TableCell className="text-right">{fmtMAD(tvaAmount)}</TableCell>
                  {isEditing && <TableCell />}
                </TableRow>
              )}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={isEditing ? 5 : 5} className="text-right font-bold">NET A PAYER T.T.C</TableCell>
                <TableCell className="text-right font-bold">{fmtMAD(totalTTC)}</TableCell>
                {isEditing && <TableCell />}
              </TableRow>
            </TableFooter>
          </Table>

          {/* Add new line section (edit mode only) */}
          {isEditing && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-3">Ajouter une ligne</h4>
              <div className="grid grid-cols-5 gap-3 items-end">
                <div className="col-span-2">
                  <Label className="text-sm">Produit</Label>
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {newLine.productId 
                          ? products.find(p => p.id === newLine.productId)?.name 
                          : "Sélectionner un produit"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Rechercher un produit..." />
                        <CommandList>
                          <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                          <CommandGroup>
                            {products.map(p => (
                              <CommandItem
                                key={p.id}
                                value={`${p.sku} ${p.name}`}
                                onSelect={() => {
                                  setNewLine({ ...newLine, productId: p.id, unitPrice: p.price });
                                  setProductOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${newLine.productId === p.id ? "opacity-100" : "opacity-0"}`} />
                                {p.sku} - {p.name} (Stock: {getProductStock(p.id)})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-sm">Qté</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newLine.qty}
                    onChange={(e) => setNewLine({ ...newLine, qty: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-sm">PU TTC</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLine.unitPrice}
                    onChange={(e) => setNewLine({ ...newLine, unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Button onClick={addNewLine} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
