import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 4000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Health check
app.get("/health", async (_, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==================== GET FULL DATABASE ====================
app.get("/api/db", async (_, res) => {
  try {
    // Try to get the full DB from app_data table
    const result = await pool.query("SELECT data FROM app_data WHERE id = 'main' LIMIT 1");
    if (result.rows.length > 0) {
      res.json(result.rows[0].data);
    } else {
      res.json(null);
    }
  } catch (e) {
    // If table doesn't exist, return null
    res.json(null);
  }
});

// ==================== SAVE FULL DATABASE ====================
app.post("/api/db", async (req, res) => {
  try {
    const data = req.body;
    
    // Upsert the data
    await pool.query(`
      INSERT INTO app_data (id, data, updated_at)
      VALUES ('main', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
    `, [JSON.stringify(data)]);
    
    res.json({ ok: true });
  } catch (e) {
    console.error("Error saving DB:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==================== BACKUP ENDPOINT ====================
app.get("/api/backup", async (_, res) => {
  try {
    const result = await pool.query("SELECT data FROM app_data WHERE id = 'main' LIMIT 1");
    if (result.rows.length > 0) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.json`);
      res.json(result.rows[0].data);
    } else {
      res.status(404).json({ error: "No data found" });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ==================== RESTORE ENDPOINT ====================
app.post("/api/restore", async (req, res) => {
  try {
    const data = req.body;
    
    await pool.query(`
      INSERT INTO app_data (id, data, updated_at)
      VALUES ('main', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
    `, [JSON.stringify(data)]);
    
    res.json({ ok: true, message: "Data restored successfully" });
  } catch (e) {
    console.error("Error restoring:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
