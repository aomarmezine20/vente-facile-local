import { AppDB, Document, DocType, Mode, Product, Depot, Client, User, StockItem, Company } from "@/types";
import { fetchDB as apiFetchDB, saveDB as apiSaveDB } from "./api";

const KEY = "sage-lite-db";

// In-memory cache
let dbCache: AppDB | null = null;
let isServerMode = false;
let serverCheckDone = false;

// Try to load from localStorage as fallback
function loadLocal(): AppDB | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppDB;
  } catch {
    return null;
  }
}

function saveLocal(db: AppDB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

// Initialize: check if server is available, load data
export async function initDB(): Promise<void> {
  if (serverCheckDone) return;
  
  try {
    const serverData = await apiFetchDB();
    if (serverData !== null) {
      dbCache = serverData;
      isServerMode = true;
      saveLocal(serverData); // Also save locally as backup
    } else {
      // Server returned null, try local
      dbCache = loadLocal();
      isServerMode = true; // Still use server mode, it just doesn't have data yet
    }
  } catch {
    // Server not available, use local only
    dbCache = loadLocal();
    isServerMode = false;
  }
  
  serverCheckDone = true;
}

// Sync to server (debounced)
let saveTimeout: NodeJS.Timeout | null = null;
async function syncToServer(db: AppDB) {
  if (!isServerMode) return;
  
  // Debounce saves to server
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await apiSaveDB(db);
  }, 500);
}

export function getDB(): AppDB {
  if (!dbCache) {
    const local = loadLocal();
    if (local) {
      dbCache = local;
      return local;
    }
    throw new Error("Database not initialized. Call seedIfNeeded().");
  }
  return dbCache;
}

export function setDB(mutator: (db: AppDB) => void): AppDB {
  const db = getDB();
  mutator(db);
  dbCache = db;
  saveLocal(db);
  syncToServer(db);
  return db;
}

export function seed(db: AppDB) {
  dbCache = db;
  saveLocal(db);
  syncToServer(db);
}

export function seedIfNeeded(seedFn: () => AppDB) {
  const db = loadLocal();
  if (!db || !db.seeded) {
    const seeded = seedFn();
    dbCache = seeded;
    saveLocal(seeded);
    syncToServer(seeded);
  } else {
    dbCache = db;
  }
}

export function nextCode(mode: Mode, type: DocType, clientType?: "particulier" | "entreprise"): string {
  const year = new Date().getFullYear().toString().slice(-2); // Get last 2 digits of year (e.g., "26")
  
  // For internal mode, use I prefix with separate counter
  if (mode === "interne") {
    const key = `interne-${type}-${year}`;
    let code = "";
    setDB((db) => {
      const n = (db.counters[key] ?? 0) + 1;
      db.counters[key] = n;
      code = `I-${type}${year}-${n.toString().padStart(5, "0")}`;
    });
    return code;
  }
  
  // Unified ID format for vente/achat - no P/E distinction, includes year
  const prefix = mode === "vente" ? "V" : "A";
  const key = `${mode}-${type}-${year}`;
  let code = "";
  setDB((db) => {
    const n = (db.counters[key] ?? 0) + 1;
    db.counters[key] = n;
    code = `${prefix}-${type}${year}-${n.toString().padStart(5, "0")}`;
  });
  return code;
}

// Generate next client code
export function nextClientCode(): string {
  let code = "";
  setDB((db) => {
    const n = (db.counters["client"] ?? 0) + 1;
    db.counters["client"] = n;
    code = `CL-${n.toString().padStart(5, "0")}`;
  });
  return code;
}

export function setCounter(mode: Mode, type: DocType, value: number) {
  const key = `${mode}-${type}`;
  setDB((db) => {
    db.counters[key] = value;
  });
}

export function getCounters(): Record<string, number> {
  return getDB().counters;
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

export function deleteStockItem(depotId: string, productId: string) {
  setDB((db) => {
    db.stock = db.stock.filter((s) => !(s.depotId === depotId && s.productId === productId));
  });
}

export function upsertUser(user: User) {
  setDB((db) => {
    const i = db.users.findIndex((u) => u.id === user.id);
    if (i >= 0) db.users[i] = user;
    else db.users.push(user);
  });
}

export function deleteUser(userId: string) {
  setDB((db) => {
    db.users = db.users.filter((u) => u.id !== userId);
  });
}

export function resetDB() {
  dbCache = null;
  localStorage.removeItem(KEY);
}

// Export server mode status
export function isUsingServer(): boolean {
  return isServerMode;
}
