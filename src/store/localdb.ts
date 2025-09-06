import { AppDB, Document, DocType, Mode, Product, Depot, Client, User, StockItem, Company } from "@/types";

const KEY = "sage-lite-db";

function load(): AppDB | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppDB;
  } catch {
    return null;
  }
}

function save(db: AppDB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function getDB(): AppDB {
  const db = load();
  if (!db) throw new Error("Database not initialized. Call seedIfNeeded().");
  return db;
}

export function setDB(mutator: (db: AppDB) => void): AppDB {
  const db = getDB();
  mutator(db);
  save(db);
  return db;
}

export function seed(db: AppDB) {
  save(db);
}

export function seedIfNeeded(seedFn: () => AppDB) {
  const db = load();
  if (!db || !db.seeded) {
    const seeded = seedFn();
    save(seeded);
  }
}

export function nextCode(mode: Mode, type: DocType): string {
  const key = `${mode}-${type}`;
  let code = "";
  setDB((db) => {
    const n = (db.counters[key] ?? 0) + 1;
    db.counters[key] = n;
    const prefix = mode === "vente" ? "V" : "A";
    code = `${prefix}-${type}-${n.toString().padStart(6, "0")}`;
  });
  return code;
}

export function upsertDocument(doc: Document) {
  setDB((db) => {
    const idx = db.documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) db.documents[idx] = doc;
    else db.documents.push(doc);
  });
}

export function getDocuments(filter?: Partial<Pick<Document, "mode" | "type">>): Document[] {
  const { documents } = getDB();
  return documents.filter((d) => {
    if (filter?.mode && d.mode !== filter.mode) return false;
    if (filter?.type && d.type !== filter.type) return false;
    return true;
  });
}

export function getDocument(id: string): Document | undefined {
  return getDB().documents.find((d) => d.id === id);
}

export function deleteDocument(id: string) {
  setDB((db) => {
    db.documents = db.documents.filter((d) => d.id !== id);
  });
}

export function getProducts(): Product[] {
  return getDB().products;
}
export function upsertProduct(p: Product) {
  setDB((db) => {
    const i = db.products.findIndex((x) => x.id === p.id);
    if (i >= 0) db.products[i] = p;
    else db.products.push(p);
  });
}

export function getDepots(): Depot[] { return getDB().depots; }
export function upsertDepot(d: Depot) {
  setDB((db) => {
    const i = db.depots.findIndex((x) => x.id === d.id);
    if (i >= 0) db.depots[i] = d;
    else db.depots.push(d);
  });
}

export function getClients(): Client[] { return getDB().clients; }
export function upsertClient(c: Client) {
  setDB((db) => {
    const i = db.clients.findIndex((x) => x.id === c.id);
    if (i >= 0) db.clients[i] = c;
    else db.clients.push(c);
  });
}

export function getCompany(): Company { return getDB().company; }
export function setCompany(company: Company) { setDB((db) => { db.company = company; }); }

export function getUsers(): User[] { return getDB().users; }
export function setCurrentUser(userId?: string) { setDB((db) => { db.currentUserId = userId; }); }
export function getCurrentUser(): User | undefined {
  const db = getDB();
  return db.users.find((u) => u.id === db.currentUserId);
}

export function getStock(): StockItem[] { return getDB().stock; }
export function setStock(items: StockItem[]) { setDB((db) => { db.stock = items; }); }

export function adjustStock(depotId: string, productId: string, deltaQty: number) {
  setDB((db) => {
    const found = db.stock.find((s) => s.depotId === depotId && s.productId === productId);
    if (found) found.qty += deltaQty;
    else db.stock.push({ depotId, productId, qty: deltaQty });
  });
}
