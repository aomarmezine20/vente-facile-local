import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClients, getDepots, getProducts, nextCode, upsertClient, upsertDocument } from "@/store/localdb";
import { Document, DocumentLine, Mode } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { toast } from "@/hooks/use-toast";

export default function DocumentForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const products = getProducts();
  const depots = getDepots();
  const [clientId, setClientId] = useState<string | undefined>(getClients()[0]?.id);
  const [vendorName, setVendorName] = useState("");
  const [depotId, setDepotId] = useState<string | undefined>(depots[0]?.id);
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [newLine, setNewLine] = useState<{ productId?: string; qty: number; unitPrice?: number; remise: number }>(
    { qty: 1, remise: 0 },
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const remiseTotal = lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
    const total = subtotal - remiseTotal;
    return { subtotal, remiseTotal, total };
  }, [lines]);

  const addLine = () => {
    if (!newLine.productId) return;
    const p = products.find((x) => x.id === newLine.productId)!;
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
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {getClients().map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Select value={newLine.productId} onValueChange={(v) => setNewLine((s) => ({ ...s, productId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Article" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>PU</TableHead>
                <TableHead>Remise</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const total = (l.unitPrice - l.remiseAmount) * l.qty;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.imageDataUrl && (
                          <img src={p.imageDataUrl} alt={l.description} className="h-10 w-10 rounded object-cover" />
                        )}
                        <span>{l.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>{l.qty}</TableCell>
                    <TableCell>{fmtMAD(l.unitPrice)}</TableCell>
                    <TableCell>{fmtMAD(l.remiseAmount)}</TableCell>
                    <TableCell>{fmtMAD(total)}</TableCell>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Enregistrer le devis</Button>
      </div>
    </div>
  );
}
