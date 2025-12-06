// frontend/src/modules/api.js

// БАЗОВЫЙ АДРЕС API (важно!)
export const API_BASE = "/api";

/**
 * Получает каталоги (продукты, продавцы, покупатели).
 */
export async function getCatalogs() {
    const r = await fetch(`${API_BASE}/catalogs`);
    if (!r.ok) throw new Error("Catalogs failed");
    return r.json();
}

/**
 * Получает записи о покупках.
 */
export async function getRecords(params = {}) {
    const query = new URLSearchParams(params).toString();
    const r = await fetch(`${API_BASE}/records?${query}`);
    if (!r.ok) throw new Error("Records failed");
    return r.json();
}

/**
 * Обновляет статистику продавцов.
 */
export async function updateSellerStats({ period_id, stats }) {
    const r = await fetch(`${API_BASE}/update-seller-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id, stats })
    });
    if (!r.ok) throw new Error("Failed to update stats");
    return r.json();
}

/**
 * Получает KPI конкретного продавца.
 */
export async function getSellerKPI(sellerId) {
    const r = await fetch(`${API_BASE}/kpi/${encodeURIComponent(sellerId)}`);
    if (!r.ok) throw new Error("KPI failed");
    return r.json();
}
