// frontend/src/modules/sellerCard.js

import { formatCurrency, formatPercentage } from "./utils.js"; // Предполагаем, что utils.js существует
import { openSellerModal } from "./sellerModal.js";

/**
 * Создает HTML-разметку для одной карточки (строки) продавца.
 * @param {object} seller - Объект данных продавца из API /api/sellers-stats.
 * @returns {string} HTML-строка
 */
export function buildSellerCard(seller) {
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
window.openSellerModal = openSellerModal;