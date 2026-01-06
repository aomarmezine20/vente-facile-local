import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getClients, upsertClient, nextClientCode } from "@/store/localdb";
import { Client, ClientType } from "@/types";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

export default function ClientManager() {
  const [clients, setClients] = useState(getClients());
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "particulier" as ClientType,
    email: "",
    phone: "",
    address: "",
    taxId: "",
    ice: "",
    notes: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "particulier",
      email: "",
      phone: "",
      address: "",
      taxId: "",
      ice: "",
      notes: ""
    });
    setEditingClient(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Le nom du client est requis", variant: "destructive" });
      return;
    }

    const clientData: Client = {
      id: editingClient?.id || `cl_${Date.now()}`,
      code: editingClient?.code || nextClientCode(),
      name: formData.name.trim(),
      type: formData.type,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      taxId: formData.taxId.trim() || undefined,
      ice: formData.ice.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    upsertClient(clientData);
    setClients(getClients());
    toast({ 
      title: editingClient ? "Client modifié" : "Client ajouté", 
      description: `${clientData.name} a été ${editingClient ? "modifié" : "ajouté"} avec succès` 
    });
    setIsOpen(false);
    resetForm();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      type: client.type,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      taxId: client.taxId || "",
      ice: client.ice || "",
      notes: client.notes || ""
    });
    setIsOpen(true);
  };

  const handleDelete = (clientId: string) => {
    // In a real app, we'd implement delete functionality
    toast({ title: "Suppression non implémentée", description: "La suppression sera ajoutée prochainement" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestion des clients</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nom du client *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom de l'entreprise ou personne"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type de client</Label>
                  <Select value={formData.type} onValueChange={(value: ClientType) => setFormData(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemple.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+212 6XX XXX XXX"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Adresse complète"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxId">Identifiant fiscal</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                    placeholder="RC, etc."
                  />
                </div>
                {formData.type === "entreprise" && (
                  <div>
                    <Label htmlFor="ice">ICE</Label>
                    <Input
                      id="ice"
                      value={formData.ice}
                      onChange={(e) => setFormData(prev => ({ ...prev, ice: e.target.value }))}
                      placeholder="ICE de l'entreprise"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes internes"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingClient ? "Modifier" : "Ajouter"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Table className="max-w-6xl">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-mono text-sm">{client.code}</TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <Badge variant={client.type === "entreprise" ? "default" : "secondary"}>
                        {client.type === "entreprise" ? "Entreprise" : "Particulier"}
                      </Badge>
                    </TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{client.address || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(client.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}