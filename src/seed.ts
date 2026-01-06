import { AppDB } from "@/types";
import { seedIfNeeded, initDB } from "@/store/localdb";

export async function runSeed() {
  // Initialize DB connection (check server first)
  await initDB();
  
  seedIfNeeded(() => {
    const now = new Date().toISOString();
    const db: AppDB = {
      company: {
        name: "Atlas Portes SARL",
        address: "123 Zone Industrielle, Casablanca",
        phone: "+212 5XX XX XX XX",
        email: "contact@atlasportes.ma",
        currency: "MAD",
        capital: "200.000,00 DH",
        rc: "487155",
        if: "48541278",
        tp: "32252429",
        ice: "002726225000084",
      },
      users: [
        { id: "u1", username: "admin", role: "admin", password: "admin" },
        { id: "u2", username: "vente", role: "sales", password: "vente" },
      ],
      currentUserId: "u1",
      clients: [
        { id: "c1", code: "CL-00001", name: "Client Particulier", type: "particulier" },
        { id: "c2", code: "CL-00002", name: "Client Entreprise", type: "entreprise" },
      ],
      depots: [
        { id: "d1", name: "Dépôt Central" },
        { id: "d2", name: "Showroom" },
      ],
      products: [
        { id: "p1", sku: "DR-001", name: "Porte Bois Chêne", unit: "u", price: 1500 },
        { id: "p2", sku: "FR-002", name: "Cadre Métal 90cm", unit: "u", price: 450 },
        { id: "p3", sku: "AC-003", name: "Poignée Inox", unit: "u", price: 120 },
      ],
      stock: [
        { productId: "p1", depotId: "d1", qty: 20 },
        { productId: "p2", depotId: "d1", qty: 50 },
        { productId: "p3", depotId: "d1", qty: 200 },
        { productId: "p1", depotId: "d2", qty: 5 },
      ],
      documents: [],
      payments: [],
      counters: { client: 2 },
      seeded: true,
    };

    return db;
  });
}

export default runSeed;
