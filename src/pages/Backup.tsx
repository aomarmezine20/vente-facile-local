import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";
import { getDB } from "@/store/localdb";

export default function Backup() {
  const { toast } = useToast();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("lastBackupDate");
    if (stored) {
      setLastBackup(stored);
    }

    // Check if we should auto-backup (every weekend - Saturday)
    checkAutoBackup();
  }, []);

  const checkAutoBackup = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const lastBackupStr = localStorage.getItem("lastBackupDate");
    
    // If it's Saturday (6)
    if (dayOfWeek === 6) {
      if (!lastBackupStr) {
        // Never backed up before
        performAutoBackup();
        return;
      }
      
      const lastBackupDate = new Date(lastBackupStr);
      const daysSinceBackup = Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If last backup was more than 6 days ago
      if (daysSinceBackup >= 6) {
        performAutoBackup();
      }
    }
  };

  const performAutoBackup = async () => {
    try {
      await downloadBackup();
      toast({
        title: "Sauvegarde automatique",
        description: "Sauvegarde hebdomadaire effectuée avec succès",
      });
    } catch (error) {
      console.error("Auto backup failed:", error);
    }
  };

  const downloadBackup = async () => {
    try {
      const db = getDB();
      const zip = new JSZip();
      
      // Add database as JSON
      zip.file("database.json", JSON.stringify(db, null, 2));
      
      // Generate zip
      const blob = await zip.generateAsync({ type: "blob" });
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      
      // Update last backup date
      const now = new Date().toISOString();
      localStorage.setItem("lastBackupDate", now);
      setLastBackup(now);
      
      toast({
        title: "Sauvegarde créée",
        description: "Votre sauvegarde a été téléchargée avec succès",
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
        throw new Error("Invalid backup file");
      }
      
      const dbContent = await dbFile.async("string");
      const newDB = JSON.parse(dbContent);
      
      // Restore to localStorage
      localStorage.setItem("db", JSON.stringify(newDB));
      
      toast({
        title: "Restauration réussie",
        description: "Les données ont été restaurées. La page va se recharger.",
      });
      
      // Reload after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de restaurer la sauvegarde",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Sauvegarde & Restauration</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Créer une sauvegarde
            </CardTitle>
            <CardDescription>
              Téléchargez toutes vos données dans un fichier ZIP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastBackup && (
              <p className="text-sm text-muted-foreground">
                Dernière sauvegarde : {new Date(lastBackup).toLocaleString('fr-FR')}
              </p>
            )}
            <Button onClick={downloadBackup} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Télécharger la sauvegarde
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
              Importez un fichier de sauvegarde pour restaurer vos données
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
                ⚠️ Attention : Cette action remplacera toutes les données actuelles
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sauvegarde automatique</CardTitle>
          <CardDescription>
            Une sauvegarde automatique est effectuée chaque samedi
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
