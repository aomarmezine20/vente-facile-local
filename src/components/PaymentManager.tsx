import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getDB, setDB } from "@/store/localdb";
import { Document, Payment, PaymentMethod } from "@/types";
import { fmtMAD, todayISO } from "@/utils/format";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Receipt } from "lucide-react";

interface PaymentManagerProps {
  document: Document;
}

export function PaymentManager({ document }: PaymentManagerProps) {
  const db = getDB();
  const documentPayments = (db.payments || []).filter(p => p.documentId === document.id);
  const totalPaid = documentPayments.reduce((sum, p) => sum + p.amount, 0);
  const documentTotal = document.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
  const remainingAmount = documentTotal - totalPaid;

  const [newPayment, setNewPayment] = useState({
    amount: remainingAmount,
    method: "cash" as PaymentMethod,
    checkNumber: "",
    notes: ""
  });

  const addPayment = () => {
    if (!newPayment.amount || newPayment.amount <= 0) {
      toast({ title: "Erreur", description: "Le montant doit être supérieur à 0", variant: "destructive" });
      return;
    }

    if (newPayment.amount > remainingAmount) {
      toast({ title: "Erreur", description: "Le montant ne peut pas dépasser le solde restant", variant: "destructive" });
      return;
    }

    if (newPayment.method === "check" && !newPayment.checkNumber.trim()) {
      toast({ title: "Erreur", description: "Numéro de chèque requis", variant: "destructive" });
      return;
    }

    const payment: Payment = {
      id: `pay_${Date.now()}`,
      documentId: document.id,
      amount: newPayment.amount,
      method: newPayment.method,
      date: todayISO(),
      checkNumber: newPayment.method === "check" ? newPayment.checkNumber : undefined,
      notes: newPayment.notes || undefined
    };

    setDB(db => {
      if (!db.payments) {
        db.payments = [];
      }
      db.payments.push(payment);
      
      // Update document payment status
      const doc = db.documents.find(d => d.id === document.id);
      if (doc) {
        const newTotalPaid = totalPaid + newPayment.amount;
        doc.totalPaid = newTotalPaid;
        
        if (newTotalPaid >= documentTotal) {
          doc.paymentStatus = "paid";
        } else if (newTotalPaid > 0) {
          doc.paymentStatus = "partial";
        } else {
          doc.paymentStatus = "unpaid";
        }
      }
    });

    toast({ title: "Règlement ajouté", description: `${fmtMAD(newPayment.amount)} enregistré` });
    setNewPayment({
      amount: remainingAmount - newPayment.amount,
      method: "cash",
      checkNumber: "",
      notes: ""
    });
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash": return <Banknote className="h-4 w-4" />;
      case "check": return <Receipt className="h-4 w-4" />;
      case "card": 
      case "transfer": return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case "cash": return "Espèces";
      case "check": return "Chèque";
      case "card": return "Carte";
      case "transfer": return "Virement";
    }
  };

  const getPaymentStatusBadge = () => {
    const status = document.paymentStatus || (totalPaid >= documentTotal ? "paid" : totalPaid > 0 ? "partial" : "unpaid");
    
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Payé</Badge>;
      case "partial":
        return <Badge variant="secondary">Partiellement payé</Badge>;
      default:
        return <Badge variant="destructive">Non payé</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Règlements</span>
          {getPaymentStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-muted-foreground">Total facture</div>
            <div className="text-lg font-semibold">{fmtMAD(documentTotal)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Montant payé</div>
            <div className="text-lg font-semibold text-green-600">{fmtMAD(totalPaid)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Solde restant</div>
            <div className="text-lg font-semibold text-red-600">{fmtMAD(remainingAmount)}</div>
          </div>
        </div>

        {remainingAmount > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">Ajouter un règlement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau règlement</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium">Montant</label>
                  <Input
                    type="number"
                    step="0.01"
                    max={remainingAmount}
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment(s => ({ ...s, amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Mode de paiement</label>
                  <Select value={newPayment.method} onValueChange={(v: PaymentMethod) => setNewPayment(s => ({ ...s, method: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Espèces</SelectItem>
                      <SelectItem value="check">Chèque</SelectItem>
                      <SelectItem value="card">Carte</SelectItem>
                      <SelectItem value="transfer">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newPayment.method === "check" && (
                  <div>
                    <label className="text-sm font-medium">Numéro de chèque</label>
                    <Input
                      value={newPayment.checkNumber}
                      onChange={(e) => setNewPayment(s => ({ ...s, checkNumber: e.target.value }))}
                      placeholder="Numéro de chèque"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Notes (optionnel)</label>
                  <Input
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment(s => ({ ...s, notes: e.target.value }))}
                    placeholder="Notes ou références"
                  />
                </div>
                <Button onClick={addPayment}>Enregistrer le règlement</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {documentPayments.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Historique des règlements</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentIcon(payment.method)}
                        {getPaymentMethodLabel(payment.method)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.checkNumber ? `Chèque #${payment.checkNumber}` : payment.notes || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{fmtMAD(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}