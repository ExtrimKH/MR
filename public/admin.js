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
document.getElementById("toggle-pw").addEventListener("click", () => {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
});

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

// ---- Бэкап ----
document.getElementById("export-btn").addEventListener("click", () => {
  window.location.href = "/api/admin/export";
});

document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const msg = document.getElementById("backup-msg");
  if (!confirm("Восстановить данные из файла? Текущие товары и тексты будут заменены.")) {
    e.target.value = "";
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || "Ошибка");
    msg.textContent = `Восстановлено товаров: ${out.count} ✓`;
    msg.hidden = false;
    loadInfo();
    loadProducts();
  } catch (err) {
    msg.textContent = "Не удалось восстановить: " + err.message;
    msg.hidden = false;
  }
  e.target.value = "";
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

// ---- Вкладки ----
document.querySelectorAll(".tab-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-products").hidden = tab !== "products";
    document.getElementById("tab-others").hidden = tab !== "others";
    if (tab === "others") loadCons();
  })
);

// ---- «Чужое» ----
async function loadCons() {
  const list = await fetch("/api/admin/consignments").then((r) => r.json());
  document.getElementById("cons-new").innerHTML = consRow(null);
  const sorted = [...list].sort((a, b) => {
    const sa = a.status === "продано" ? 1 : 0;
    const sb = b.status === "продано" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return a.createdAt - b.createdAt;
  });
  document.getElementById("cons-list").innerHTML = sorted.map(consRow).join("");
  attachConsHandlers();
}

function consRow(c) {
  const isNew = !c;
  c = c || {};
  const sold = c.status === "продано";
  const sel = (v) => (c.status === v ? "selected" : "");
  return `
    <div class="cons-row ${isNew ? "cons-row--new" : ""} ${sold ? "is-sold" : ""}" data-id="${c.id || ""}">
      <label>Кошелёк<input class="c-wallet" value="${escapeHtml(c.wallet || "")}" /></label>
      <label>Ник<input class="c-nick" value="${escapeHtml(c.nick || "")}" /></label>
      <label>Что на продаже<input class="c-item" value="${escapeHtml(c.item || "")}" /></label>
      <label>Комментарий<input class="c-comment" value="${escapeHtml(c.comment || "")}" /></label>
      <label>Оплачено<input class="c-paid" value="${escapeHtml(c.paid || "")}" /></label>
      <label>Статус
        <select class="c-status">
          <option value="выставлено" ${sel("выставлено") || (isNew ? "selected" : "")}>выставлено</option>
          <option value="продано" ${sel("продано")}>продано</option>
        </select>
      </label>
      <div class="cons-actions">
        <button type="button" class="c-save">${isNew ? "Добавить" : "Сохранить"}</button>
        ${isNew ? "" : '<button type="button" class="c-del danger">Удалить</button>'}
      </div>
    </div>`;
}

function readConsRow(row) {
  return {
    wallet: row.querySelector(".c-wallet").value,
    nick: row.querySelector(".c-nick").value,
    item: row.querySelector(".c-item").value,
    comment: row.querySelector(".c-comment").value,
    paid: row.querySelector(".c-paid").value,
    status: row.querySelector(".c-status").value,
  };
}

function attachConsHandlers() {
  // новая запись
  const newRow = document.querySelector("#cons-new .cons-row");
  newRow.querySelector(".c-save").addEventListener("click", async () => {
    await fetch("/api/admin/consignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readConsRow(newRow)),
    });
    loadCons();
  });
  // существующие записи
  document.querySelectorAll("#cons-list .cons-row").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".c-save").addEventListener("click", async () => {
      await fetch(`/api/admin/consignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readConsRow(row)),
      });
      loadCons();
    });
    row.querySelector(".c-del").addEventListener("click", async () => {
      if (!confirm("Удалить запись?")) return;
      await fetch(`/api/admin/consignments/${id}`, { method: "DELETE" });
      loadCons();
    });
  });
}

init();
