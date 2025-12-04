import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Upload, FileText, Download, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getClients, getProducts, getDocuments } from "@/store/localdb";
import { generateCertificatePdf } from "@/pdf/warranty";

interface Certificate {
  id: string;
  documentId: string;
  documentCode: string;
  clientName: string;
  clientType: "revendeur" | "particulier" | "entreprise";
  productTypes: string;
  quantity: number;
  articlesPerCertificate: number;
  date: string;
  createdAt: string;
}

interface CertificateTemplate {
  id: string;
  name: string;
  dataUrl: string;
  uploadedAt: string;
}

export default function CertificateManager() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", dataUrl: "" });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Generate certificate form
  const [selectedDocument, setSelectedDocument] = useState("");
  const [clientType, setClientType] = useState<"revendeur" | "particulier" | "entreprise">("particulier");
  const [articlesPerCertificate, setArticlesPerCertificate] = useState(1);

  const documents = getDocuments().filter(d => d.mode === "vente" && d.type === "FA");
  const clients = getClients();
  const products = getProducts();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const storedCerts = localStorage.getItem("certificates");
    if (storedCerts) {
      setCertificates(JSON.parse(storedCerts));
    }
    const storedTemplates = localStorage.getItem("certificateTemplates");
    if (storedTemplates) {
      setTemplates(JSON.parse(storedTemplates));
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== "application/pdf") {
      toast.error("Veuillez sélectionner un fichier PDF");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewTemplate({
        ...newTemplate,
        dataUrl: reader.result as string
      });
      toast.success("PDF chargé avec succès");
    };
    reader.readAsDataURL(file);
  };

  const saveTemplate = () => {
    if (!newTemplate.name || !newTemplate.dataUrl) {
      toast.error("Nom et fichier PDF requis");
      return;
    }

    const template: CertificateTemplate = {
      id: `tpl_${Date.now()}`,
      name: newTemplate.name,
      dataUrl: newTemplate.dataUrl,
      uploadedAt: new Date().toISOString()
    };

    const updated = [...templates, template];
    setTemplates(updated);
    localStorage.setItem("certificateTemplates", JSON.stringify(updated));
    setNewTemplate({ name: "", dataUrl: "" });
    setShowUploadDialog(false);
    toast.success("Modèle de certificat enregistré");
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem("certificateTemplates", JSON.stringify(updated));
    toast.success("Modèle supprimé");
  };

  const generateCertificates = async () => {
    if (!selectedDocument) {
      toast.error("Veuillez sélectionner un document");
      return;
    }

    const doc = documents.find(d => d.id === selectedDocument);
    if (!doc) return;

    const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
    const productTypes = doc.lines
      .map(line => products.find(p => p.id === line.productId)?.name)
      .filter((name, index, self) => name && self.indexOf(name) === index)
      .join(", ");

    const totalQty = doc.lines.reduce((sum, line) => sum + line.qty, 0);
    
    // For revendeur: generate one certificate per article
    // For particulier/entreprise: generate based on articlesPerCertificate
    const numCertificates = clientType === "revendeur" 
      ? totalQty 
      : Math.ceil(totalQty / articlesPerCertificate);

    const newCertificates: Certificate[] = [];

    for (let i = 0; i < numCertificates; i++) {
      const timestamp = Date.now() + i;
      const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;
      
      const cert: Certificate = {
        id: certificateId,
        documentId: doc.id,
        documentCode: doc.code,
        clientName: client?.name || "",
        clientType: clientType,
        productTypes: productTypes,
        quantity: clientType === "revendeur" ? 1 : articlesPerCertificate,
        articlesPerCertificate: clientType === "revendeur" ? 1 : articlesPerCertificate,
        date: new Date(doc.date).toLocaleDateString('fr-FR'),
        createdAt: new Date().toISOString()
      };

      newCertificates.push(cert);
      
      // Generate PDF for each certificate
      await generateCertificatePdf(doc, cert, templates[0]?.dataUrl);
    }

    const allCerts = [...certificates, ...newCertificates];
    setCertificates(allCerts);
    localStorage.setItem("certificates", JSON.stringify(allCerts));
    
    setShowGenerateDialog(false);
    setSelectedDocument("");
    toast.success(`${numCertificates} certificat(s) généré(s) avec succès`);
  };

  const deleteCertificate = (id: string) => {
    const updated = certificates.filter(c => c.id !== id);
    setCertificates(updated);
    localStorage.setItem("certificates", JSON.stringify(updated));
    toast.success("Certificat supprimé");
  };

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = 
      cert.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.documentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.productTypes.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === "all" || cert.clientType === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredCertificates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCertificates = filteredCertificates.slice(startIndex, startIndex + itemsPerPage);
  
  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestion des Certificats</h1>
        <div className="flex gap-2">
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Télécharger modèle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un modèle de certificat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nom du modèle</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Ex: Certificat Garantie 2024"
                  />
                </div>
                <div>
                  <Label>Fichier PDF</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleTemplateUpload}
                  />
                  {newTemplate.dataUrl && (
                    <p className="text-sm text-green-600 mt-1">✓ PDF chargé</p>
                  )}
                </div>
                <Button onClick={saveTemplate} className="w-full">
                  Enregistrer le modèle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Générer certificat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Générer un certificat de garantie</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Facture source</Label>
                  <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une facture" />
                    </SelectTrigger>
                    <SelectContent>
                      {documents.map(doc => {
                        const client = doc.clientId ? clients.find(c => c.id === doc.clientId) : null;
                        return (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.code} - {client?.name || "Sans client"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Type de client</Label>
                  <Select value={clientType} onValueChange={(v: any) => setClientType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revendeur">Revendeur (1 certificat par article)</SelectItem>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                  {clientType === "revendeur" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Un certificat sera généré pour chaque article
                    </p>
                  )}
                </div>

                {clientType !== "revendeur" && (
                  <div>
                    <Label>Articles par certificat</Label>
                    <Input
                      type="number"
                      min={1}
                      value={articlesPerCertificate}
                      onChange={(e) => setArticlesPerCertificate(Number(e.target.value))}
                    />
                  </div>
                )}

                <Button onClick={generateCertificates} className="w-full">
                  Générer le(s) certificat(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="certificates">
        <TabsList>
          <TabsTrigger value="certificates">Certificats ({certificates.length})</TabsTrigger>
          <TabsTrigger value="templates">Modèles ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <CardTitle>Registre des certificats</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par ID, client, produit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtrer par type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="revendeur">Revendeur</SelectItem>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredCertificates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Aucun certificat trouvé" : "Aucun certificat émis pour le moment"}
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-2">
                    {filteredCertificates.length} certificat(s) trouvé(s) - Page {currentPage} sur {totalPages}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Certificat</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Produits</TableHead>
                        <TableHead>Qté</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCertificates.map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {cert.id}
                            </Badge>
                          </TableCell>
                          <TableCell>{cert.documentCode}</TableCell>
                          <TableCell>{cert.clientName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={cert.clientType === "revendeur" ? "default" : "secondary"}>
                              {cert.clientType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{cert.productTypes || "-"}</TableCell>
                          <TableCell>{cert.quantity}</TableCell>
                          <TableCell>{cert.date}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/document/${cert.documentId}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCertificate(cert.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ‹
                      </Button>
                      <span className="px-3 text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        »
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Modèles de certificats</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun modèle téléchargé. Cliquez sur "Télécharger modèle" pour ajouter un PDF.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Date d'ajout</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tpl) => (
                      <TableRow key={tpl.id}>
                        <TableCell className="font-medium">{tpl.name}</TableCell>
                        <TableCell>
                          {new Date(tpl.uploadedAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = tpl.dataUrl;
                                link.download = `${tpl.name}.pdf`;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTemplate(tpl.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
