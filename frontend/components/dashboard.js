export async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();

    const totalProductsEl = document.getElementById('totalProducts');
    if (totalProductsEl) {
      totalProductsEl.textContent = data.stats?.total_products || 'N/A';
    }

    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl) {
      totalRecordsEl.textContent = data.stats?.total_records || 'N/A';
    }

    const totalCustomersEl = document.getElementById('totalCustomers');
    if (totalCustomersEl) {
      totalCustomersEl.textContent = data.stats?.total_customers || 'N/A';
    }
  } catch (error) {
    ['totalProducts', 'totalRecords', 'totalCustomers'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Ошибка загрузки';
    });
  }
}

async function loadProfile(userId) {
  try {
    const response = await fetch(`/api/profile/data?userId=${userId}`);
    if (!response.ok) throw new Error('Не удалось загрузить профиль');
    const data = await response.json();

    const firstNameEl = document.getElementById('firstName');
    const lastNameEl = document.getElementById('lastName');
    const departmentEl = document.getElementById('department');

    if (firstNameEl) firstNameEl.value = data.first_name || '';
    if (lastNameEl) lastNameEl.value = data.last_name || '';
    if (departmentEl) departmentEl.value = data.department || '';

    document.getElementById('personalRevenue').textContent = formatCurrency(data.total_revenue || 0);
    document.getElementById('personalProfit').textContent = formatCurrency(data.total_profit || 0);
    document.getElementById('personalSalesCount').textContent = data.total_quantity || 0;

    const plan = Number(data.plan_revenue || 50000);
    const revenue = Number(data.total_revenue || 0);
    const kpi = plan > 0 ? Math.round((revenue / plan) * 100) : 0;
    document.getElementById('personalKPI').textContent = kpi + '%';
    document.getElementById('personalBonus').textContent = formatCurrency(data.bonus || 0);

    const messageEl = document.getElementById('profileMessage');
    if (messageEl) messageEl.textContent = '';
  } catch (err) {
    const messageEl = document.getElementById('profileMessage');
    if (messageEl) {
      messageEl.textContent = 'Ошибка загрузки профиля';
      messageEl.classList.add('error');
    }
  }
}

async function saveProfile(userId) {
  const payload = {
    userId,
    first_name: document.getElementById('firstName')?.value.trim() || '',
    last_name: document.getElementById('lastName')?.value.trim() || '',
    department: document.getElementById('department')?.value.trim() || ''
  };

  try {
    const response = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const messageEl = document.getElementById('profileMessage');

    if (result.success) {
      if (messageEl) {
        messageEl.textContent = 'Профиль сохранён!';
        messageEl.classList.remove('error');
      }
      loadProfile(userId);
    } else {
      throw new Error(result.error || 'Ошибка сохранения');
    }
  } catch (err) {
    const messageEl = document.getElementById('profileMessage');
    if (messageEl) {
      messageEl.textContent = err.message || 'Ошибка сохранения';
      messageEl.classList.add('error');
    }
  }
}

async function addSale(userId) {
  const payload = {
    userId,
    purchase_date: document.getElementById('saleDate').value,
    sku: document.getElementById('sku').value.trim(),
    quantity: Number(document.getElementById('quantity').value) || 1,
    price: Number(document.getElementById('price').value) || 0,
    discount: Number(document.getElementById('discount').value) || 0
  };

  try {
    const response = await fetch('/api/add-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const messageEl = document.getElementById('salesMessage');

    if (result.success) {
      if (messageEl) {
        messageEl.textContent = result.message || 'Продажа добавлена!';
        messageEl.classList.remove('error');
      }
      document.getElementById('salesForm').reset();
      loadProfile(userId);
    } else {
      throw new Error(result.error || 'Ошибка добавления');
    }
  } catch (err) {
    const messageEl = document.getElementById('salesMessage');
    if (messageEl) {
      messageEl.textContent = err.message || 'Ошибка добавления продажи';
      messageEl.classList.add('error');
    }
  }
}

function formatCurrency(n) {
  return (Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

export function initDashboard(userId) {
  loadDashboard();
  loadProfile(userId);

  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', e => {
      e.preventDefault();
      saveProfile(userId);
    });
  }

  const salesForm = document.getElementById('salesForm');
  if (salesForm) {
    salesForm.addEventListener('submit', e => {
      e.preventDefault();
      addSale(userId);
    });
  }
}