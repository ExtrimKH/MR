const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");

async function init() {
  const { isAdmin } = await fetch("/api/me").then((r) => r.json());
  if (isAdmin) showAdmin();
  else loginView.hidden = false;
}

function showAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
  loadInfo();
  loadProducts();
}

// ---- Вход / выход ----
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  err.hidden = true;
  const password = document.getElementById("password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) showAdmin();
  else {
    err.textContent = "Неверный пароль";
    err.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.reload();
});

// ---- Тексты ----
async function loadInfo() {
  const info = await fetch("/api/info").then((r) => r.json());
  document.getElementById("weBuy").value = info.weBuy || "";
}

document.getElementById("info-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await fetch("/api/info", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weBuy: document.getElementById("weBuy").value,
    }),
  });
  const saved = document.getElementById("info-saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 2000);
});

// ---- Товары ----
async function loadProducts() {
  const products = await fetch("/api/admin/products").then((r) => r.json());
  const list = document.getElementById("admin-products");
  if (!products.length) {
    list.innerHTML = '<p class="empty">Пока нет товаров.</p>';
    return;
  }
  list.innerHTML = products
    .map(
      (p) => `
    <div class="admin-item${p.hidden ? " is-hidden" : ""}">
      <div class="admin-thumb">${
        p.image ? `<img src="${p.image}" alt="" />` : '<span>нет фото</span>'
      }</div>
      <div class="admin-item-body">
        <strong>${escapeHtml(p.title)}</strong>
        ${badges(p)}
        ${p.price ? `<div class="price">${escapeHtml(p.price)}</div>` : ""}
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        ${p.hidden ? '<span class="hidden-tag">Скрыт</span>' : ""}
      </div>
      <div class="admin-item-actions">
        <button class="secondary" data-edit="${p.id}">Изменить</button>
        <button class="secondary" data-toggle="${p.id}">${
        p.hidden ? "Показать" : "Скрыть"
      }</button>
        <button class="danger" data-delete="${p.id}">Удалить</button>
      </div>
    </div>`
    )
    .join("");

  list.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.delete))
  );
  list.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => startEdit(btn.dataset.edit, products))
  );
  list.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => toggleHidden(btn.dataset.toggle))
  );
}

function badges(p) {
  const items = [];
  if (p.rarity && p.rarity !== "None")
    items.push(`<span class="badge rarity-${p.rarity}">${p.rarity}</span>`);
  if (p.productType && p.productType !== "None")
    items.push(`<span class="badge kind">${p.productType}</span>`);
  if (p.partType && p.partType !== "None")
    items.push(`<span class="badge type">${p.partType}</span>`);
  if (p.carType && p.carType !== "None")
    items.push(`<span class="badge type">${p.carType}</span>`);
  return items.length ? `<div class="badges">${items.join("")}</div>` : "";
}

async function toggleHidden(id) {
  await fetch(`/api/products/${id}/toggle-hidden`, { method: "POST" });
  loadProducts();
}

const productForm = document.getElementById("product-form");
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("product-error");
  err.hidden = true;

  const id = document.getElementById("edit-id").value;
  const fd = new FormData();
  fd.append("title", document.getElementById("title").value);
  fd.append("price", document.getElementById("price").value);
  fd.append("productType", document.getElementById("productType").value);
  fd.append("partType", document.getElementById("partType").value);
  fd.append("rarity", document.getElementById("rarity").value);
  fd.append("carType", document.getElementById("carType").value);
  fd.append("description", document.getElementById("description").value);
  const file = document.getElementById("image").files[0];
  if (file) fd.append("image", file);

  const url = id ? `/api/products/${id}` : "/api/products";
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, { method, body: fd });

  if (res.ok) {
    resetForm();
    loadProducts();
  } else {
    const data = await res.json().catch(() => ({}));
    err.textContent = data.error || "Ошибка сохранения";
    err.hidden = false;
  }
});

function startEdit(id, products) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  document.getElementById("edit-id").value = p.id;
  document.getElementById("title").value = p.title;
  document.getElementById("price").value = p.price || "";
  document.getElementById("productType").value = p.productType || "None";
  document.getElementById("partType").value = p.partType || "None";
  document.getElementById("rarity").value = p.rarity || "None";
  document.getElementById("carType").value = p.carType || "None";
  document.getElementById("description").value = p.description || "";
  document.getElementById("image").value = "";
  document.getElementById("product-form-title").textContent = "Изменить товар";
  document.getElementById("save-product-btn").textContent = "Сохранить";
  document.getElementById("cancel-edit-btn").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);

function resetForm() {
  productForm.reset();
  document.getElementById("edit-id").value = "";
  document.getElementById("product-form-title").textContent = "Добавить товар";
  document.getElementById("save-product-btn").textContent = "Добавить";
  document.getElementById("cancel-edit-btn").hidden = true;
}

async function deleteProduct(id) {
  if (!confirm("Удалить товар?")) return;
  await fetch(`/api/products/${id}`, { method: "DELETE" });
  loadProducts();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

init();
