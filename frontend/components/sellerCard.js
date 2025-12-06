/*// frontend/src/modules/sellerCard.js

import { formatCurrency, formatPercentage } from "./utils.js"; // Предполагаем, что utils.js существует
import { openSellerModal } from "./sellerModal.js";

/**
 * Создает HTML-разметку для одной карточки (строки) продавца.
 * @param {object} seller - Объект данных продавца из API /api/sellers-stats.
 * @returns {string} HTML-строка
 */
/*export function buildSellerCard(seller) {
    // ВАЖНО: Используем поля, которые возвращает /api/sellers-stats: total_revenue, total_profit, total_quantity
    const revenue = formatCurrency(seller.total_revenue);
    const profit = formatCurrency(seller.total_profit);
    const salesCount = seller.total_quantity || 0; // salesCount теперь total_quantity
    const kpi = formatPercentage(seller.kpi || 0);
    const bonus = formatCurrency(seller.bonus || 0);
    const sellerName = seller.name || `ID: ${seller.seller_id}`;

    // Функция для открытия модального окна
    const openModal = `openSellerModal('${seller.seller_id}', '${sellerName}')`;

    return `
        <div class="seller-card">
            <div class="seller-name-col">
                <a href="#" class="seller-name-link" onclick="${openModal}">${sellerName}</a>
            </div>
            <div class="seller-data-col">${revenue}</div>
            <div class="seller-data-col">${profit}</div>
            <div class="seller-data-col">${salesCount}</div>
            <div class="seller-data-col kpi-col">${kpi}</div>
            <div class="seller-data-col">${bonus}</div>
            <div class="seller-data-col top-products-col">
                <span class="product-icon">📦</span>
                <!-- Сюда можно добавить ссылку на topProducts, если будут данные -->
            </div>
            <div class="seller-data-col action-col">
                <button class="btn btn-secondary" onclick="${openModal}">Открыть</button>
            </div>
        </div>
    `;
}

// Добавляем обработчик в window, чтобы он был доступен из HTML-строки
window.openSellerModal = openSellerModal;*/
// frontend/src/modules/sellerCard.js
import { API_BASE } from "./api.js";

/**
 * Загружает полную инфу продавца.
 */
export async function loadSellerFullInfo(seller_id) {
    const r = await fetch(`${API_BASE}/seller-full?seller_id=${encodeURIComponent(seller_id)}`);
    if (!r.ok) throw new Error("Seller full info failed");
    return r.json();
}

/**
 * Открывает модальное окно карточки продавца.
 */
export async function openSellerCard(seller_id) {
    const modal = document.getElementById("sellerCardModal");
    const content = document.getElementById("sellerCardContent");

    content.innerHTML = `<div class="loader">Загрузка...</div>`;
    modal.style.display = "block";

    try {
        const s = await loadSellerFullInfo(seller_id);

        content.innerHTML = `
            <div class="seller-card">
                <h2>Карточка продавца</h2>

                <div class="seller-main">
                    <p><strong>ID:</strong> ${s.seller_id}</p>
                    <p><strong>Имя:</strong> ${s.name}</p>
                    <p><strong>Отдел:</strong> ${s.department || "—"}</p>
                </div>

                <div class="seller-stats">
                    <h3>Показатели</h3>
                    <p><strong>Выручка:</strong> ${Number(s.total_revenue).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Прибыль:</strong> ${Number(s.total_profit).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Бонус:</strong> ${Number(s.bonus).toLocaleString("ru-RU")} ₽</p>
                    <p><strong>Средний чек:</strong> ${Number(s.average_check).toFixed(2)} ₽</p>
                    <p><strong>Средняя прибыль:</strong> ${Number(s.average_profit).toFixed(2)} ₽</p>
                </div>

                <button id="closeSellerCard" class="btn btn-secondary" style="margin-top: 1em;">
                    Закрыть
                </button>
            </div>
        `;

        document.getElementById("closeSellerCard").onclick = () => {
            modal.style.display = "none";
        };

        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = "none";
        };

    } catch (err) {
        console.error(err);
        content.innerHTML = `<p class="error">Ошибка загрузки карточки продавца</p>`;
    }
}
