import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface Certificate {
  id: string;
  documentId: string;
  documentCode: string;
  clientName: string;
  productTypes: string;
  quantity: number;
  date: string;
  createdAt: string;
}

export default function CertificateRegistry() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  useEffect(() => {
    const loadCertificates = () => {
      const stored = localStorage.getItem("certificates");
      if (stored) {
        setCertificates(JSON.parse(stored));
      }
    };
    loadCertificates();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registre des Certificats</h1>
        <Badge variant="secondary">{certificates.length} certificat(s)</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les certificats émis</CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun certificat émis pour le moment
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Certificat</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {cert.id}
                      </Badge>
                    </TableCell>
                    <TableCell>{cert.documentCode}</TableCell>
                    <TableCell>{cert.clientName || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{cert.productTypes || "-"}</TableCell>
                    <TableCell>{cert.quantity}</TableCell>
                    <TableCell>{cert.date}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/document/${cert.documentId}`)}
                      >
                        Voir document
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
