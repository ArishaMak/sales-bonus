// frontend/components/dashboard.js

export async function loadDashboard() {
    console.log('🔄 Loading dashboard...');
    try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        console.log('DASHBOARD:', data);

        // РЕНДЕР с проверками DOM
        const totalProductsEl = document.getElementById('totalProducts');
        if (totalProductsEl) {
            totalProductsEl.textContent = data.stats?.total_products || 'N/A';
        } else {
            console.warn('⚠ Element #totalProducts not found in HTML');
        }

        const totalRecordsEl = document.getElementById('totalRecords');
        if (totalRecordsEl) {
            totalRecordsEl.textContent = data.stats?.total_records || 'N/A';
        } else {
            console.warn('⚠ Element #totalRecords not found in HTML');
        }

        const totalCustomersEl = document.getElementById('totalCustomers');
        if (totalCustomersEl) {
            totalCustomersEl.textContent = data.stats?.total_customers || 'N/A';
        } else {
            console.warn('⚠ Element #totalCustomers not found in HTML');
        }

        console.log('✅ Dashboard rendered');
    } catch (error) {
        console.error('❌ Dashboard load failed:', error.message);
        // Fallback: Установи дефолтные значения в элементы, если они есть
        ['totalProducts', 'totalRecords', 'totalCustomers'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Ошибка загрузки';
        });
    }
}