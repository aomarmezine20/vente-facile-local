import { AppDB } from "@/types";

// API URL - use environment variable or fallback to localhost
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchDB(): Promise<AppDB | null> {
  try {
    const response = await fetch(`${API_URL}/api/db`);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch DB from server:", error);
    return null;
  }
}

export async function saveDB(db: AppDB): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(db),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to save DB to server:", error);
    return false;
  }
}

export async function downloadBackup(): Promise<AppDB | null> {
  try {
    const response = await fetch(`${API_URL}/api/backup`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Failed to download backup:", error);
    return null;
  }
}

export async function restoreBackup(data: AppDB): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return false;
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return data.ok === true;
  } catch {
    return false;
  }
}
