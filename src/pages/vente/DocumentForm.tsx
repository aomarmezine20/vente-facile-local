import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { getClients, getDepots, getProducts, nextCode, upsertClient, upsertDocument, getStock } from "@/store/localdb";
import { Document, DocumentLine, Mode } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DocumentForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const products = getProducts();
  const depots = getDepots();
  const stock = getStock();
  const clients = getClients();
  const [clientId, setClientId] = useState<string | undefined>(clients[0]?.id);
  const [vendorName, setVendorName] = useState("");
  const [depotId, setDepotId] = useState<string | undefined>(depots[0]?.id);
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [newLine, setNewLine] = useState<{ productId?: string; qty: number; unitPrice?: number; remise: number }>(
    { qty: 1, remise: 0 },
  );
  const [openClientSelect, setOpenClientSelect] = useState(false);
  const [openProductSelect, setOpenProductSelect] = useState(false);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const remiseTotal = lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
    const total = subtotal - remiseTotal;
    return { subtotal, remiseTotal, total };
  }, [lines]);

  const addLine = () => {
    if (!newLine.productId || !depotId) return;
    const p = products.find((x) => x.id === newLine.productId)!;
    
    // Check stock availability for sales
    if (mode === "vente") {
      const availableStock = stock.find(s => s.productId === newLine.productId && s.depotId === depotId)?.qty || 0;
      const requestedQty = newLine.qty || 1;
      if (availableStock < requestedQty) {
        return toast({ 
          title: "Stock insuffisant", 
          description: `Stock disponible: ${availableStock} ${p.unit}. Quantité demandée: ${requestedQty} ${p.unit}`,
          variant: "destructive"
        });
      }
    }
    
    const unitPrice = newLine.unitPrice ?? p.price;
    const l: DocumentLine = {
      id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: p.id,
      description: p.name,
      qty: newLine.qty || 1,
      unitPrice,
      remiseAmount: newLine.remise || 0,
    };
    setLines((arr) => [...arr, l]);
    setNewLine({ qty: 1, remise: 0 });
  };

  const removeLine = (id: string) => setLines((arr) => arr.filter((l) => l.id !== id));

  const save = () => {
    if (!depotId) return toast({ title: "Sélectionnez un dépôt" });
    if (mode === "vente" && !clientId) return toast({ title: "Sélectionnez un client" });
    if (mode === "achat" && !vendorName) return toast({ title: "Saisissez un fournisseur" });

    const id = `doc_${Date.now()}`;
    const code = nextCode(mode, "DV");
    const doc: Document = {
      id,
      code,
      type: "DV",
      mode,
      date: todayISO(),
      status: "brouillon",
      depotId,
      clientId: mode === "vente" ? clientId : undefined,
      vendorName: mode === "achat" ? vendorName : undefined,
      lines,
    };
    upsertDocument(doc);
    toast({ title: "Devis enregistré", description: code });
    navigate(`/document/${id}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nouveau devis — {mode === "vente" ? "Vente" : "Achat"}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm">Dépôt</label>
            <Select value={depotId} onValueChange={setDepotId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {depots.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "vente" ? (
            <div>
              <label className="mb-1 block text-sm">Client</label>
              <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openClientSelect}
                    className="w-full justify-between"
                  >
                    {clientId
                      ? clients.find((c) => c.id === clientId)?.name
                      : "Rechercher un client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un client..." />
                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.email || ""} ${c.phone || ""}`}
                          onSelect={() => {
                            setClientId(c.id);
                            setOpenClientSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.type === "entreprise" ? "Entreprise" : "Particulier"}
                              {c.email && ` • ${c.email}`}
                              {c.phone && ` • ${c.phone}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm">Fournisseur</label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Nom du fournisseur" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {newLine.productId
                    ? (() => {
                        const p = products.find((x) => x.id === newLine.productId);
                        const availableStock = depotId ? stock.find(s => s.productId === newLine.productId && s.depotId === depotId)?.qty || 0 : 0;
                        const showStock = mode === "vente" && depotId;
                        return (
                          <span className="flex items-center justify-between w-full">
                            <span className="truncate">{p?.sku} — {p?.name}</span>
                            {showStock && (
                              <Badge variant={availableStock > 0 ? "default" : "destructive"} className="ml-2">
                                {availableStock}
                              </Badge>
                            )}
                          </span>
                        );
                      })()
                    : "Rechercher un article..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher par réf. ou nom..." />
                  <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {products.map((p) => {
                      const availableStock = depotId ? stock.find(s => s.productId === p.id && s.depotId === depotId)?.qty || 0 : 0;
                      const showStock = mode === "vente" && depotId;
                      return (
                        <CommandItem
                          key={p.id}
                          value={`${p.sku} ${p.name}`}
                          onSelect={() => {
                            setNewLine((s) => ({ ...s, productId: p.id }));
                            setOpenProductSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              newLine.productId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">Réf: {p.sku} • Prix: {p.price} MAD</span>
                            </div>
                            {showStock && (
                              <Badge variant={availableStock > 0 ? "default" : "destructive"} className="ml-2">
                                Stock: {availableStock}
                              </Badge>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              type="number"
              min={1}
              value={newLine.qty}
              onChange={(e) => setNewLine((s) => ({ ...s, qty: Number(e.target.value) }))}
              placeholder="Qté"
            />
            <Input
              type="number"
              step="0.01"
              value={newLine.unitPrice ?? ""}
              onChange={(e) => setNewLine((s) => ({ ...s, unitPrice: Number(e.target.value) }))}
              placeholder="PU (MAD)"
            />
            <Input
              type="number"
              step="0.01"
              value={newLine.remise}
              onChange={(e) => setNewLine((s) => ({ ...s, remise: Number(e.target.value) }))}
              placeholder="Remise (MAD/Unité)"
            />
            <Button onClick={addLine}>Ajouter</Button>
          </div>

          <div className="flex justify-center mt-4">
            <Table className="max-w-6xl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Réf.</TableHead>
                  <TableHead className="text-center">Désignation</TableHead>
                  <TableHead className="text-center">Qté</TableHead>
                  <TableHead className="text-center">PU</TableHead>
                  <TableHead className="text-center">Remise</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center"></TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const total = (l.unitPrice - l.remiseAmount) * l.qty;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-center">{p.sku}</TableCell>
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
                    <TableCell className="text-center">{l.qty}</TableCell>
                    <TableCell className="text-center">{fmtMAD(l.unitPrice)}</TableCell>
                    <TableCell className="text-center">{fmtMAD(l.remiseAmount)}</TableCell>
                    <TableCell className="text-center">{fmtMAD(total)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(l.id)}>
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}></TableCell>
                <TableCell>Sous-total</TableCell>
                <TableCell>{fmtMAD(totals.subtotal)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}></TableCell>
                <TableCell>Remises</TableCell>
                <TableCell>{fmtMAD(totals.remiseTotal)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}></TableCell>
                <TableCell>Total</TableCell>
                <TableCell>{fmtMAD(totals.total)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Enregistrer le devis</Button>
      </div>
    </div>
  );
}
