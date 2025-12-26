const API_BASE = '/api';

export async function getCatalogs() {
  const r = await fetch(`${API_BASE}/catalogs`);
  if (!r.ok) throw new Error("Catalogs failed");
  return r.json();
}

export async function getRecords(params = {}) {
  const query = new URLSearchParams(params).toString();
  const r = await fetch(`${API_BASE}/records?${query}`);
  if (!r.ok) throw new Error("Records failed");
  return r.json();
}

export async function updateSellerStats({ period_id, stats }) {
  const r = await fetch(`${API_BASE}/update-seller-stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ period_id, stats })
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Failed to update stats");
  return result;
}

export async function getSellerKPI(sellerId) {
  const r = await fetch(`${API_BASE}/kpi/${encodeURIComponent(sellerId)}`);
  if (!r.ok) throw new Error("KPI failed");
  return r.json();
}

// Личный кабинет
export async function getProfileData(userId) {
  const r = await fetch(`${API_BASE}/profile/${userId}`);
  const result = await r.json();
  if (!r.ok) {
    throw new Error(result.error || 'Failed to load profile data');
  }
  return result;
}

export async function saveProfileData(data) {
  const r = await fetch(`${API_BASE}/profile/${data.userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) {
    throw new Error(result.error || 'Failed to save profile');
  }
  return result;
}

// Авторизация
export async function registerUser({ email, password, name }) {
  const r = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const result = await r.json();
  if (!r.ok) {
    throw new Error(result.error || 'Ошибка регистрации.');
  }
  return result.user;
}

export async function saveSellerProfile(payload) {
  const r = await fetch(`${API_BASE}/profile/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Profile update failed');
  return r.json();
}