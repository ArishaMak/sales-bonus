// frontend/src/modules/filters.js
// Управление фильтрами приложения

export function initFilters(sellers, purchases) {
  const sellerFilter = document.getElementById("sellerFilter");
  const skuFilter = document.getElementById("skuFilter");
  const searchInput = document.getElementById("search");

  if (sellerFilter) {
    sellerFilter.innerHTML = `
      <option value="">Все продавцы</option>
      ${sellers.map(s => `
        <option value="${s.seller_id}">${s.name}</option>
      `).join("")}
    `;
  }

  if (skuFilter && purchases) {
    const allSku = new Set();
    purchases.forEach(p => (p.items || []).forEach(i => allSku.add(i.sku)));

    skuFilter.innerHTML = `
      <option value="">Все товары</option>
      ${Array.from(allSku).map(sku => `
        <option value="${sku}">${sku}</option>
      `).join("")}
    `;
  }

  if (searchInput) {
    searchInput.placeholder = "Поиск по ФИО или товару...";
  }
}
