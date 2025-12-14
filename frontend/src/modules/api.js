// frontend/src/modules/api.js

const API_BASE = '/api';

/**
 * Получает основные каталоги (продукты, продавцы, покупатели).
 * @returns {Promise<object>} Объект с каталогами.
 * @throws {Error} Если запрос не удался.
 */
export async function getCatalogs() {
    const r = await fetch(`${API_BASE}/catalogs`);
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
    const r = await fetch(`${API_BASE}/records?${query}`);
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
    const r = await fetch(`${API_BASE}/update-seller-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id, stats })
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Failed to update stats");
    return result;
}

/**
 * Получает ключевые показатели эффективности (KPI) для конкретного продавца.
 * @param {string} sellerId - Идентификатор продавца.
 * @returns {Promise<object>} Данные KPI.
 * @throws {Error} Если запрос не удался.
 */
export async function getSellerKPI(sellerId) {
    const r = await fetch(`${API_BASE}/kpi/${encodeURIComponent(sellerId)}`);
    if (!r.ok) throw new Error("KPI failed");
    return r.json();
}

// -------------------------------------------------------------
// 🔥 ФУНКЦИИ ДЛЯ ЛИЧНОГО КАБИНЕТА
// -------------------------------------------------------------

/**
 * Загружает данные пользователя и продавца для личного кабинета.
 * @param {number} userId - ID текущего пользователя.
 * @returns {Promise<object>} Объект с данными профиля.
 * @throws {Error} Если запрос не удался.
 */
export async function getProfileData(userId) {
    // ИЗМЕНЕНО: Используем path param для соответствия backend (/api/profile/:id)
    const r = await fetch(`${API_BASE}/profile/${userId}`);
    const result = await r.json();
    if (!r.ok) {
        throw new Error(result.error || 'Failed to load profile data');
    }
    return result;
}

/**
 * Сохраняет или активирует профиль продавца.
 * @param {object} data - Данные формы (userId, first_name, last_name, department, bonus).
 * @returns {Promise<object>} Сообщение об успешном сохранении/активации.
 * @throws {Error} Если сохранение не удалось.
 */
export async function saveProfileData(data) {
    // ИЗМЕНЕНО: Используем PUT и path param для соответствия backend (/api/profile/:id)
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

// -------------------------------------------------------------
// 🔥 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (ДЛЯ АВТОРИЗАЦИИ)
// -------------------------------------------------------------

/**
 * Функция для регистрации нового пользователя.
 * @param {object} credentials - { email, password, name }
 * @returns {Promise<object>} Объект нового пользователя.
 * @throws {Error} В случае ошибки (например, дубликат email).
 */
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
    return result.user; // Возвращаем объект пользователя { id, email, name }
}