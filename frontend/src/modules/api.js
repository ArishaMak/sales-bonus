// frontend/src/modules/api.js

/**
 * Получает основные каталоги (продукты, продавцы, покупатели).
 * @returns {Promise<object>} Объект с каталогами.
 * @throws {Error} Если запрос не удался.
 */
export async function getCatalogs() {
    const r = await fetch("/api/catalogs");
    if (!r.ok) throw new Error("Catalogs failed");
    return r.json();
}

/**
 * Получает записи о покупках с пагинацией и поиском.
 * @param {object} [params={}] - Параметры запроса (page, limit, search).
 * @returns {Promise<object>} Объект с пагинированными записями.
 * @throws {Error} Если запрос не удался.
 */
export async function getRecords(params = {}) {
    const query = new URLSearchParams(params).toString();
    const r = await fetch(`/api/records?${query}`);
    if (!r.ok) throw new Error("Records failed");
    return r.json();
}

/**
 * Обновляет статистику продавцов.
 * @param {object} payload - Объект с period_id и массивом stats.
 * @param {string} payload.period_id - Идентификатор периода (пока не используется в бэкенде).
 * @param {Array<object>} payload.stats - Массив объектов статистики продавцов.
 * @returns {Promise<object>} Сообщение об успешном обновлении.
 * @throws {Error} Если обновление не удалось.
 */
export async function updateSellerStats({ period_id, stats }) {
    const r = await fetch("/api/update-seller-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id, stats })
    });
    if (!r.ok) throw new Error("Failed to update stats");
    return r.json();
}

/**
 * Получает ключевые показатели эффективности (KPI) для конкретного продавца.
 * @param {string} sellerId - Идентификатор продавца.
 * @returns {Promise<object>} Данные KPI.
 * @throws {Error} Если запрос не удался.
 */
export async function getSellerKPI(sellerId) {
    const r = await fetch(`/api/kpi/${encodeURIComponent(sellerId)}`);
    if (!r.ok) throw new Error("KPI failed");
    return r.json();
}