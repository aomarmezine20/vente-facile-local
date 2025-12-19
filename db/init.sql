-- Main app data table (stores full JSON state)
CREATE TABLE IF NOT EXISTS app_data (
  id VARCHAR PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
