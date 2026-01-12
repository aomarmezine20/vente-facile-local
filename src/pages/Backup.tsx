import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Database, Server, Laptop, FileText, Users, Package, Warehouse, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";
import { getDB, isUsingServer } from "@/store/localdb";
import { downloadBackup as apiDownloadBackup, restoreBackup as apiRestoreBackup } from "@/store/api";

export default function Backup() {
  const { toast } = useToast();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [serverMode, setServerMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("lastBackupDate");
    if (stored) {
      setLastBackup(stored);
    }
    setServerMode(isUsingServer());
  }, []);

  const downloadBackup = async () => {
    try {
      const db = getDB();
      const zip = new JSZip();
      
      // Get certificates from localStorage
      const certificates = JSON.parse(localStorage.getItem("certificates") || "[]");
      const certificateTemplates = JSON.parse(localStorage.getItem("certificateTemplates") || "[]");
      const stockTransfers = JSON.parse(localStorage.getItem("stock-transfers") || "[]");
      
      // Add complete database as JSON - includes EVERYTHING
      const fullBackup = {
        ...db,
        certificates,
        certificateTemplates,
        stockTransfers,
      };
      zip.file("database.json", JSON.stringify(fullBackup, null, 2));
      
      // Add separate files for easier inspection
      zip.file("company.json", JSON.stringify(db.company, null, 2));
      zip.file("clients.json", JSON.stringify(db.clients, null, 2));
      zip.file("products.json", JSON.stringify(db.products, null, 2));
      zip.file("depots.json", JSON.stringify(db.depots, null, 2));
      zip.file("stock.json", JSON.stringify(db.stock, null, 2));
      zip.file("documents.json", JSON.stringify(db.documents, null, 2));
      zip.file("payments.json", JSON.stringify(db.payments, null, 2));
      zip.file("users.json", JSON.stringify(db.users, null, 2));
      zip.file("counters.json", JSON.stringify(db.counters, null, 2));
      zip.file("certificates.json", JSON.stringify(certificates, null, 2));
      zip.file("certificateTemplates.json", JSON.stringify(certificateTemplates, null, 2));
      zip.file("stockTransfers.json", JSON.stringify(stockTransfers, null, 2));
      
      // Add a manifest with backup info
      const manifest = {
        backupDate: new Date().toISOString(),
        version: "1.1",
        stats: {
          clients: db.clients.length,
          products: db.products.length,
          depots: db.depots.length,
          documents: db.documents.length,
          payments: db.payments.length,
          users: db.users.length,
          stockItems: db.stock.length,
          stockTransfers: stockTransfers.length,
        }
      };
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      
      // Generate zip
      const blob = await zip.generateAsync({ type: "blob" });
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_complet_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      // Update last backup date
      const now = new Date().toISOString();
      localStorage.setItem("lastBackupDate", now);
      setLastBackup(now);
      
      toast({
        title: "Sauvegarde complète créée",
        description: `${db.documents.length} documents, ${db.clients.length} clients, ${db.products.length} produits sauvegardés`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la sauvegarde",
        variant: "destructive",
      });
    }
  };

  const uploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      // Read database.json
      const dbFile = contents.file("database.json");
      if (!dbFile) {
        throw new Error("Invalid backup file - database.json not found");
      }
      
      const dbContent = await dbFile.async("string");
      const newDB = JSON.parse(dbContent);
      
      // Validate the backup structure
      if (!newDB.company || !newDB.clients || !newDB.products || !newDB.documents) {
        throw new Error("Invalid backup file - missing required data");
      }
      
      // Restore certificates if present
      if (newDB.certificates) {
        localStorage.setItem("certificates", JSON.stringify(newDB.certificates));
        delete newDB.certificates;
      }
      if (newDB.certificateTemplates) {
        localStorage.setItem("certificateTemplates", JSON.stringify(newDB.certificateTemplates));
        delete newDB.certificateTemplates;
      }
      if (newDB.stockTransfers) {
        localStorage.setItem("stock-transfers", JSON.stringify(newDB.stockTransfers));
        delete newDB.stockTransfers;
      }
      
      // Restore to localStorage
      localStorage.setItem("sage-lite-db", JSON.stringify(newDB));
      
      // Also restore to server if in server mode
      if (serverMode) {
        await apiRestoreBackup(newDB);
      }
      
      toast({
        title: "Restauration réussie",
        description: `${newDB.documents.length} documents, ${newDB.clients.length} clients, ${newDB.products.length} produits restaurés. La page va se recharger.`,
      });
      
      // Reload after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de restaurer la sauvegarde",
        variant: "destructive",
      });
    }
  };

  const db = getDB();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Sauvegarde & Restauration</h1>
      
      {/* Server mode indicator */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {serverMode ? (
              <>
                <Server className="h-5 w-5 text-green-500" />
                Mode Serveur Actif
              </>
            ) : (
              <>
                <Laptop className="h-5 w-5 text-yellow-500" />
                Mode Local
              </>
            )}
          </CardTitle>
          <CardDescription>
            {serverMode 
              ? "Les données sont synchronisées avec le serveur PostgreSQL. Tous les PCs partagent les mêmes données."
              : "Les données sont stockées localement. Chaque PC a ses propres données."
            }
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current data stats */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            Données actuelles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{db.documents.length}</div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{db.clients.length}</div>
                <div className="text-xs text-muted-foreground">Clients</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{db.products.length}</div>
                <div className="text-xs text-muted-foreground">Produits</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Warehouse className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{db.stock.length}</div>
                <div className="text-xs text-muted-foreground">Stocks</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Créer une sauvegarde complète
            </CardTitle>
            <CardDescription>
              Téléchargez toutes vos données dans un fichier ZIP : documents, clients, produits, stock, paiements, paramètres...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastBackup && (
              <p className="text-sm text-muted-foreground">
                Dernière sauvegarde : {new Date(lastBackup).toLocaleString('fr-FR')}
              </p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>La sauvegarde inclut :</p>
              <ul className="list-disc list-inside ml-2">
                <li>Tous les documents (devis, BC, BL, BR, factures)</li>
                <li>Tous les clients avec leurs codes</li>
                <li>Tous les produits et le stock</li>
                <li>Tous les paiements</li>
                <li>Les paramètres de la société</li>
                <li>Les compteurs de numérotation</li>
                <li>Les certificats de garantie</li>
                <li>Les modèles de certificats</li>
                <li>Les transferts de stock</li>
              </ul>
            </div>
            <Button onClick={downloadBackup} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Télécharger la sauvegarde complète
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurer une sauvegarde
            </CardTitle>
            <CardDescription>
              Importez un fichier de sauvegarde pour restaurer toutes vos données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <label htmlFor="backup-upload" className="cursor-pointer">
                  <Button asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Choisir un fichier
                    </span>
                  </Button>
                </label>
                <input
                  id="backup-upload"
                  type="file"
                  accept=".zip"
                  onChange={uploadBackup}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-destructive">
                ⚠️ Attention : Cette action remplacera TOUTES les données actuelles (documents, clients, produits, stock, paiements, paramètres...)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}