// ========== STATE ==========
let currentUser = null;
let token = localStorage.getItem("token") || null;

const API = {
  async request(method, url, body = null) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" }
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
    return data;
  },
  get: (url) => API.request("GET", url),
  post: (url, body) => API.request("POST", url, body),
  put: (url, body) => API.request("PUT", url, body),
  patch: (url, body) => API.request("PATCH", url, body),
  delete: (url) => API.request("DELETE", url)
};

// ========== UI HELPERS ==========
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + (isError ? "toast-error" : "toast-ok");
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3500);
}

function showSection(name) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(name + "-section");
  if (el) el.classList.remove("hidden");

  // highlight nav
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.section === name);
  });

  // load data for section
  if (name === "services") loadServices();
  if (name === "cars") loadCars();
  if (name === "create-order") prepareOrderForm();
  if (name === "my-orders") loadMyOrders();
  if (name === "admin-orders") loadAdminOrders();
  if (name === "admin-services") loadAdminServices();
}

function renderNav() {
  const nav = document.getElementById("nav");
  if (!currentUser) {
    nav.innerHTML = `
      <button class="nav-btn" onclick="showSection('services')">Услуги</button>
      <button class="nav-btn btn-accent" onclick="showSection('auth')">Вход / Регистрация</button>
    `;
    return;
  }

  let html = `
    <button class="nav-btn" data-section="services" onclick="showSection('services')">Услуги</button>
    <button class="nav-btn" data-section="cars" onclick="showSection('cars')">Мои авто</button>
    <button class="nav-btn" data-section="create-order" onclick="showSection('create-order')">Новая заявка</button>
    <button class="nav-btn" data-section="my-orders" onclick="showSection('my-orders')">Мои заявки</button>
  `;
  if (currentUser.role === "admin") {
    html += `
      <button class="nav-btn" data-section="admin-orders" onclick="showSection('admin-orders')">Все заявки</button>
      <button class="nav-btn" data-section="admin-services" onclick="showSection('admin-services')">Услуги (админ)</button>
    `;
  }
  html += `
    <span class="user-badge">${currentUser.login} (${currentUser.role === "admin" ? "Админ" : "Клиент"})</span>
    <button class="nav-btn btn-logout" onclick="doLogout()">Выйти</button>
  `;
  nav.innerHTML = html;
}

// ========== AUTH ==========
async function initAuth() {
  if (!token) {
    currentUser = null;
    renderNav();
    showSection("services");
    return;
  }
  try {
    const data = await API.get("/api/me");
    currentUser = data.user;
    renderNav();
    showSection("services");
  } catch {
    token = null;
    localStorage.removeItem("token");
    currentUser = null;
    renderNav();
    showSection("services");
  }
}

async function doLogin() {
  const login = document.getElementById("login-login").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("auth-error");
  errEl.classList.add("hidden");
  try {
    const data = await API.post("/api/login", { login, password });
    token = data.token;
    localStorage.setItem("token", token);
    currentUser = data.user;
    showToast("Добро пожаловать, " + currentUser.login);
    renderNav();
    showSection("services");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}

async function doRegister() {
  const login = document.getElementById("reg-login").value.trim();
  const password = document.getElementById("reg-password").value;
  const phone_number = document.getElementById("reg-phone").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const errEl = document.getElementById("auth-error");
  errEl.classList.add("hidden");
  try {
    const data = await API.post("/api/register", { login, password, phone_number, email: email || null });
    token = data.token;
    localStorage.setItem("token", token);
    currentUser = data.user;
    showToast("Регистрация успешна!");
    renderNav();
    showSection("services");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}

function doLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem("token");
  renderNav();
  showSection("services");
  showToast("Вы вышли из системы");
}

// Auth tabs
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
      document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
      document.getElementById("auth-error").classList.add("hidden");
    });
  });
  initAuth();
});

// ========== SERVICES ==========
async function loadServices() {
  const container = document.getElementById("services");
  try {
    const services = await API.get("/api/services");
    if (!services.length) {
      container.innerHTML = "<p>Услуг пока нет</p>";
      return;
    }
    container.innerHTML = services.map(s => `
      <div class="service-card">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.description || "")}</p>
        <p class="service-price">${s.price} ₽</p>
      </div>
    `).join("");
  } catch (e) {
    container.innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

// ========== CARS ==========
async function loadCars() {
  const list = document.getElementById("cars-list");
  try {
    const cars = await API.get("/api/cars");
    if (!cars.length) {
      list.innerHTML = "<p class='empty'>У вас пока нет автомобилей. Добавьте первый!</p>";
      return;
    }
    list.innerHTML = cars.map(c => `
      <div class="list-card">
        <div>
          <strong>${escapeHtml(c.brand)} ${escapeHtml(c.model)}</strong> (${c.year})
          <div class="muted">VIN: ${escapeHtml(c.vin)}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteCar(${c.id})">Удалить</button>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

async function addCar() {
  const brand = document.getElementById("car-brand").value.trim();
  const model = document.getElementById("car-model").value.trim();
  const year = document.getElementById("car-year").value;
  const vin = document.getElementById("car-vin").value.trim();
  try {
    await API.post("/api/cars", { brand, model, year, vin });
    showToast("Автомобиль добавлен");
    document.getElementById("car-brand").value = "";
    document.getElementById("car-model").value = "";
    document.getElementById("car-year").value = "";
    document.getElementById("car-vin").value = "";
    loadCars();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteCar(id) {
  if (!confirm("Удалить этот автомобиль?")) return;
  try {
    await API.delete(`/api/cars/${id}`);
    showToast("Автомобиль удалён");
    loadCars();
  } catch (e) {
    showToast(e.message, true);
  }
}

// ========== ORDERS ==========
async function prepareOrderForm() {
  const carSelect = document.getElementById("order-car");
  const svcSelect = document.getElementById("order-service");
  try {
    const [cars, services] = await Promise.all([
      API.get("/api/cars"),
      API.get("/api/services")
    ]);
    carSelect.innerHTML = cars.length
      ? cars.map(c => `<option value="${c.id}">${escapeHtml(c.brand)} ${escapeHtml(c.model)} (${c.year})</option>`).join("")
      : `<option value="">Сначала добавьте автомобиль</option>`;
    svcSelect.innerHTML = services.map(s =>
      `<option value="${s.id}">${escapeHtml(s.title)} — ${s.price} ₽</option>`
    ).join("");
  } catch (e) {
    showToast(e.message, true);
  }
}

async function createOrder() {
  const car_id = parseInt(document.getElementById("order-car").value, 10);
  const service_id = parseInt(document.getElementById("order-service").value, 10);
  const description = document.getElementById("order-desc").value.trim();
  if (!car_id || !service_id) {
    showToast("Выберите автомобиль и услугу", true);
    return;
  }
  try {
    await API.post("/api/orders", { car_id, service_id, description: description || null });
    showToast("Заявка успешно создана!");
    document.getElementById("order-desc").value = "";
    showSection("my-orders");
  } catch (e) {
    showToast(e.message, true);
  }
}

async function loadMyOrders() {
  const list = document.getElementById("my-orders-list");
  try {
    const orders = await API.get("/api/orders/my");
    if (!orders.length) {
      list.innerHTML = "<p class='empty'>У вас пока нет заявок</p>";
      return;
    }
    list.innerHTML = orders.map(o => `
      <div class="list-card order-card">
        <div class="order-header">
          <strong>#${o.id} — ${escapeHtml(o.service_title)}</strong>
          <span class="status status-${statusClass(o.status)}">${escapeHtml(o.status)}</span>
        </div>
        <div class="muted">${escapeHtml(o.brand)} ${escapeHtml(o.model)} (${o.year}) · VIN: ${escapeHtml(o.vin)}</div>
        ${o.description ? `<div class="order-desc">${escapeHtml(o.description)}</div>` : ""}
        <div class="order-meta">
          <span>${o.service_price} ₽</span>
          <span>${formatDate(o.created_at)}</span>
        </div>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

// ========== ADMIN ORDERS ==========
async function loadAdminOrders() {
  const list = document.getElementById("admin-orders-list");
  try {
    const orders = await API.get("/api/orders");
    if (!orders.length) {
      list.innerHTML = "<p class='empty'>Заявок пока нет</p>";
      return;
    }
    const statuses = ["Новая заявка", "Принята", "В ремонте", "Завершена", "Отклонена"];
    list.innerHTML = orders.map(o => `
      <div class="list-card order-card">
        <div class="order-header">
          <strong>#${o.id} — ${escapeHtml(o.service_title)}</strong>
          <span class="status status-${statusClass(o.status)}">${escapeHtml(o.status)}</span>
        </div>
        <div class="muted">
          Клиент: <b>${escapeHtml(o.user_login)}</b> (${escapeHtml(o.user_phone || "—")}) ·
          ${escapeHtml(o.brand)} ${escapeHtml(o.model)} (${o.year})
        </div>
        ${o.description ? `<div class="order-desc">${escapeHtml(o.description)}</div>` : ""}
        <div class="order-meta">
          <span>${o.service_price} ₽</span>
          <span>${formatDate(o.created_at)}</span>
        </div>
        <div class="order-actions">
          <label>Статус:</label>
          <select onchange="changeStatus(${o.id}, this.value)">
            ${statuses.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

async function changeStatus(id, status) {
  try {
    await API.patch(`/api/orders/${id}/status`, { status });
    showToast("Статус обновлён");
    loadAdminOrders();
  } catch (e) {
    showToast(e.message, true);
  }
}

// ========== ADMIN SERVICES ==========
async function loadAdminServices() {
  const list = document.getElementById("admin-services-list");
  try {
    const services = await API.get("/api/services");
    list.innerHTML = services.map(s => `
      <div class="list-card">
        <div>
          <strong>${escapeHtml(s.title)}</strong> — ${s.price} ₽
          <div class="muted">${escapeHtml(s.description || "")}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">Удалить</button>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<p class="error-msg">${e.message}</p>`;
  }
}

async function addService() {
  const title = document.getElementById("svc-title").value.trim();
  const price = document.getElementById("svc-price").value;
  const description = document.getElementById("svc-desc").value.trim();
  try {
    await API.post("/api/services", { title, price, description: description || null });
    showToast("Услуга добавлена");
    document.getElementById("svc-title").value = "";
    document.getElementById("svc-price").value = "";
    document.getElementById("svc-desc").value = "";
    loadAdminServices();
    loadServices();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteService(id) {
  if (!confirm("Удалить эту услугу?")) return;
  try {
    await API.delete(`/api/services/${id}`);
    showToast("Услуга удалена");
    loadAdminServices();
    loadServices();
  } catch (e) {
    showToast(e.message, true);
  }
}

// ========== UTILS ==========
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

function statusClass(status) {
  const map = {
    "Новая заявка": "new",
    "Принята": "accepted",
    "В ремонте": "progress",
    "Завершена": "done",
    "Отклонена": "rejected"
  };
  return map[status] || "new";
}
