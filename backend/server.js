import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 4000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get("/health", async (_, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Example routes (extend as needed in future iterations)
app.get("/api/products", async (_, res) => {
  const { rows } = await pool.query("select * from products order by name");
  res.json(rows);
});

app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
