import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { getClients, getCompany, getDepots, getProducts, getUsers, setCompany, upsertClient, upsertDepot, upsertProduct, getStock, adjustStock } from "@/store/localdb";
import { Product, Depot, Client, Company } from "@/types";
import { fmtMAD } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";

export default function AdminPage() {
  const [company, setCompanyState] = useState<Company>(getCompany());
  const [products, setProducts] = useState<Product[]>(getProducts());
  const [depots, setDepots] = useState<Depot[]>(getDepots());
  const [clients, setClients] = useState<Client[]>(getClients());
  const users = getUsers();

  const location = useLocation();
  const [tab, setTab] = useState<string>(() => (window.location.hash?.slice(1) || "societe"));
  useEffect(() => {
    const h = location.hash?.slice(1) || "societe";
    if (h !== tab) setTab(h);
  }, [location.hash]);
  const onTabChange = (v: string) => {
    setTab(v);
    history.replaceState(null, "", `/admin#${v}`);
  };

  const logoInput = useRef<HTMLInputElement>(null);

  const saveCompany = () => {
    setCompany(company);
    setCompanyState(getCompany());
    toast({ title: "Paramètres sauvegardés" });
  };

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const logoDataUrl = reader.result as string;
      const updated = { ...company, logoDataUrl };
      setCompany(updated);
      setCompanyState(updated);
      toast({ title: "Logo mis à jour" });
    };
    reader.readAsDataURL(file);
  };

  const addProduct = () => {
    const p: Product = { id: `p_${Date.now()}`, sku: "NEW", name: "Nouvel article", unit: "u", price: 0 };
    upsertProduct(p);
    setProducts(getProducts());
  };

  const addDepot = () => {
    const d: Depot = { id: `d_${Date.now()}`, name: "Nouveau dépôt" };
    upsertDepot(d);
    setDepots(getDepots());
  };

  const addClient = () => {
    const c: Client = { id: `c_${Date.now()}`, name: "Nouveau client", type: "comptoir" };
    upsertClient(c);
    setClients(getClients());
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administration</h1>
        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value="societe">Société</TabsTrigger>
            <TabsTrigger value="produits">Produits</TabsTrigger>
            <TabsTrigger value="depots">Dépôts</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          </TabsList>

        <TabsContent value="societe">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres société</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm">Nom</label>
                <Input value={company.name} onChange={(e) => setCompanyState({ ...company, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Téléphone</label>
                <Input value={company.phone || ""} onChange={(e) => setCompanyState({ ...company, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm">Adresse</label>
                <Input value={company.address || ""} onChange={(e) => setCompanyState({ ...company, address: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Email</label>
                <Input value={company.email || ""} onChange={(e) => setCompanyState({ ...company, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Logo</label>
                <div className="flex items-center gap-3">
                  <Input ref={logoInput} type="file" accept="image/*" onChange={onLogoChange} />
                </div>
              </div>
              <div className="md:col-span-2">
                <Button onClick={saveCompany}>Sauvegarder</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produits">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Produits</CardTitle>
              <Button onClick={addProduct}>Ajouter</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead>Prix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.imageDataUrl && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <img src={p.imageDataUrl} alt={p.name} className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <img src={p.imageDataUrl} alt={p.name} className="w-full h-auto rounded-lg" />
                                <div className="text-center mt-2">
                                  <h3 className="font-semibold">{p.name}</h3>
                                  <p className="text-sm text-muted-foreground">Référence: {p.sku}</p>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            className="text-xs"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                p.imageDataUrl = reader.result as string;
                                upsertProduct(p);
                                setProducts(getProducts());
                                toast({ title: "Image article mise à jour" });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={p.sku} onChange={(e) => { p.sku = e.target.value; upsertProduct(p); setProducts(getProducts()); }} />
                      </TableCell>
                      <TableCell>
                        <Input value={p.name} onChange={(e) => { p.name = e.target.value; upsertProduct(p); setProducts(getProducts()); }} />
                      </TableCell>
                      <TableCell>
                        <Input value={p.unit} onChange={(e) => { p.unit = e.target.value; upsertProduct(p); setProducts(getProducts()); }} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={p.price} onChange={(e) => { p.price = Number(e.target.value); upsertProduct(p); setProducts(getProducts()); }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depots">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Dépôts</CardTitle>
              <Button onClick={addDepot}>Ajouter</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depots.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Input value={d.name} onChange={(e) => { d.name = e.target.value; upsertDepot(d); setDepots(getDepots()); }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium">Stocks par dépôt</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dépôt</TableHead>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead>Qté actuelle</TableHead>
                      <TableHead>Ajuster stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getStock().map((s) => {
                      const depot = depots.find((d) => d.id === s.depotId)?.name || s.depotId;
                      const prod = products.find((p) => p.id === s.productId);
                      return (
                        <TableRow key={`${s.depotId}-${s.productId}`}>
                          <TableCell>{depot}</TableCell>
                          <TableCell>{prod?.sku || s.productId}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            {prod?.imageDataUrl && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <img src={prod.imageDataUrl} alt={prod.name} className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <img src={prod.imageDataUrl} alt={prod.name} className="w-full h-auto rounded-lg" />
                                  <div className="text-center mt-2">
                                    <h3 className="font-semibold">{prod.name}</h3>
                                    <p className="text-sm text-muted-foreground">Référence: {prod.sku}</p>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <span>{prod?.name || "-"}</span>
                          </TableCell>
                          <TableCell className="font-medium">{s.qty}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="+/-"
                                className="w-20"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    const delta = parseInt(input.value);
                                    if (delta && delta !== 0) {
                                      adjustStock(s.depotId, s.productId, delta);
                                      toast({ 
                                        title: "Stock ajusté", 
                                        description: `${delta > 0 ? '+' : ''}${delta} unités pour ${prod?.name}` 
                                      });
                                      input.value = '';
                                      window.location.reload();
                                    }
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  const delta = parseInt(input.value);
                                  if (delta && delta !== 0) {
                                    adjustStock(s.depotId, s.productId, delta);
                                    toast({ 
                                      title: "Stock ajusté", 
                                      description: `${delta > 0 ? '+' : ''}${delta} unités pour ${prod?.name}` 
                                    });
                                    input.value = '';
                                    window.location.reload();
                                  }
                                }}
                              >
                                OK
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Clients</CardTitle>
              <Button onClick={addClient}>Ajouter</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Input value={c.name} onChange={(e) => { c.name = e.target.value; upsertClient(c); setClients(getClients()); }} />
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-9 rounded-md border bg-background px-3"
                          value={c.type}
                          onChange={(e) => { c.type = e.target.value as Client["type"]; upsertClient(c); setClients(getClients()); }}
                        >
                          <option value="comptoir">Comptoir</option>
                          <option value="web">Web</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="utilisateurs">
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="mt-2 text-sm text-muted-foreground">Comptes par défaut: admin/admin, vente/vente</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
