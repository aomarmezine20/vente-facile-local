export type Mode = "vente" | "achat";
export type DocType = "DV" | "BC" | "BL" | "BR" | "FA";

export interface Company {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string; // base64
  currency: "MAD";
}

export type ClientType = "particulier" | "entreprise";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
}

export interface User {
  id: string;
  username: string;
  role: "admin" | "sales";
  password: string; // demo only (local)
}

export interface Depot {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string; // e.g., "u"
  price: number; // base price for vente (MAD)
  imageDataUrl?: string;
  category?: string;
}

export interface StockItem {
  productId: string;
  depotId: string;
  qty: number;
}

export interface DocumentLine {
  id: string;
  productId: string;
  description: string;
  qty: number;
  unitPrice: number; // MAD
  remiseAmount: number; // MAD per unit (NOT percent)
}

export type DocumentStatus =
  | "brouillon"
  | "valide"
  | "commande"
  | "livre"
  | "facture"
  | "comptabilise";

export type PaymentMethod = "especes" | "cheque" | "virement" | "carte" | "autre";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface Payment {
  id: string;
  documentId: string;
  amount: number;
  method: PaymentMethod;
  date: string; // ISO
  checkNumber?: string; // for check payments
  notes?: string;
}

export interface DocumentBase {
  id: string;
  code: string; // e.g., V-DV-000001
  type: DocType;
  mode: Mode;
  date: string; // ISO
  status: DocumentStatus;
  depotId?: string; // depot concerné
  clientId?: string; // for vente (or fournisseur name for achat)
  vendorName?: string; // for achat simple
  notes?: string;
  refFromId?: string; // source doc id
  paymentStatus?: PaymentStatus;
  totalPaid?: number;
  includeInAccounting?: boolean; // Track if this should be included in accounting reports
}

export interface Document extends DocumentBase {
  lines: DocumentLine[];
}

export interface AppDB {
  company: Company;
  users: User[];
  currentUserId?: string;
  clients: Client[];
  depots: Depot[];
  products: Product[];
  stock: StockItem[];
  documents: Document[];
  payments: Payment[];
  counters: Record<string, number>; // key: `${mode}-${type}`
  seeded?: boolean;
}
