// frontend/src/modules/api.js
export async function getCatalogs() {
    const r = await fetch("/api/catalogs");
    if (!r.ok) throw new Error("Catalogs failed");
    return r.json();
}

export async function getRecords(params = {}) {
    const query = new URLSearchParams(params).toString();
    const r = await fetch(`/api/records?${query}`);
    if (!r.ok) throw new Error("Records failed");
    return r.json();
}

export async function updateSellerStats({ period_id, stats }) {
    const r = await fetch("/api/update-seller-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id, stats })
    });
    if (!r.ok) throw new Error("Failed to update stats");
    return r.json();
}

export async function getSellerKPI(sellerId) {
    const r = await fetch(`/api/kpi/${encodeURIComponent(sellerId)}`);
    if (!r.ok) throw new Error("KPI failed");
    return r.json();
}

export async function getSellerFull(sellerId) {
    const response = await fetch(`/api/seller-full?seller_id=${sellerId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch seller data for ID ${sellerId}`);
    }
    const data = await response.json();
    return data;
}