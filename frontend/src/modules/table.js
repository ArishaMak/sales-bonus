// frontend/src/modules/table.js

/** Экранирование HTML */
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Генерация строки таблицы */
export function renderSellerRow(s) {
  const kpi = s.plan ? ((s.revenue / s.plan) * 100).toFixed(0) : 0;
  const topProdsStr = (s.top_products || []).slice(0, 3).map(p => `${escapeHtml(p.sku)} (${p.quantity})`).join(", ") + (s.top_products.length > 3 ? " и др." : "");
  
  // Подготавливаем данные для передачи в функцию в виде строки JSON
  // Экранируем кавычки, чтобы не сломать HTML-атрибут
  const sellerJson = JSON.stringify(s).replace(/"/g, '&quot;');

  return `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${Number(s.revenue || 0).toLocaleString()}</td>
      <td>${Number(s.profit || 0).toLocaleString()}</td>
      <td>${s.sales_count || 0}</td>
      <td>${kpi}%</td>
      <td>${Number(s.bonus || 0).toLocaleString()}</td>
      <td title="${(s.top_products || []).map(p => `${p.sku} (${p.quantity})`).join(', ')}">${topProdsStr}</td>
      <td>
        <button 
          class="btn btn-secondary"
          onclick='window.openSellerCard(${sellerJson})'
        >
          Открыть
        </button>
      </td>
    </tr>
  `;
}

/** Генерация нескольких строк */
export function renderSellerTableRows(sellers = []) {
  return sellers.map(renderSellerRow).join("");
}