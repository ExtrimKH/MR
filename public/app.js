let allProducts = [];

async function load() {
  const [products, info] = await Promise.all([
    fetch("/api/products").then((r) => r.json()),
    fetch("/api/info").then((r) => r.json()),
  ]);

  renderWeBuy(info.weBuy || "");

  allProducts = products;
  ["filter-rarity", "filter-type", "filter-product", "filter-part"].forEach(
    (id) => document.getElementById(id).addEventListener("change", render)
  );
  render();
}

function render() {
  const rarity = document.getElementById("filter-rarity").value;
  const type = document.getElementById("filter-type").value;
  const product = document.getElementById("filter-product").value;
  const part = document.getElementById("filter-part").value;

  const filtered = allProducts.filter(
    (p) =>
      (!rarity || (p.rarity || "None") === rarity) &&
      (!type || (p.carType || "None") === type) &&
      (!product || (p.productType || "None") === product) &&
      (!part || (p.partType || "None") === part)
  );

  const grid = document.getElementById("products");
  const empty = document.getElementById("empty");

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = allProducts.length
      ? "Нет товаров по выбранным фильтрам."
      : "Пока нет товаров.";
    return;
  }

  empty.hidden = true;
  grid.innerHTML = filtered.map(card).join("");

  grid.querySelectorAll(".buy-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const p = allProducts.find((x) => x.id === btn.dataset.id);
      if (p) buyProduct(p);
    })
  );
}

function card(p) {
  const img = p.image
    ? `<img src="${p.image}" alt="" loading="lazy" />`
    : `<div class="no-image">нет фото</div>`;
  const price = p.price
    ? `<div class="price">${escapeHtml(formatPrice(p.price))}</div>`
    : "";
  const desc = p.description
    ? `<p class="desc">${escapeHtml(p.description)}</p>`
    : "";
  const rcls =
    p.rarity === "Legendary" ? "r-leg" : p.rarity === "Epic" ? "r-epic" : "";
  return `
    <article class="product ${rcls}">
      <div class="product-img">${img}</div>
      <div class="product-body">
        <h3>${escapeHtml(p.title)}</h3>
        ${cardMeta(p)}
        ${price}
        ${desc}
        <button class="buy-btn" data-id="${p.id}">Купить</button>
      </div>
    </article>`;
}

const ADMIN_TG = "https://t.me/givemepermissions";

async function buyProduct(p) {
  const text = buildOrderText(p);
  await copyText(text);
  toast("Текст заказа скопирован — вставьте его в чат (Ctrl+V) и отправьте");
  window.open(ADMIN_TG, "_blank");
}

function buildOrderText(p) {
  const types = [p.rarity, p.partType, p.carType, p.productType].filter(
    (t) => t && t !== "None"
  );
  let msg = `Здравствуйте! Хочу купить: ${p.title}`;
  if (types.length) msg += ` (${types.join(", ")})`;
  if (p.price) msg += `, цена ${formatPrice(p.price)}`;
  if (p.image) msg += `\nФото: ${new URL(p.image, location.origin).href}`;
  return msg;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    ta.remove();
  }
}

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}

function renderWeBuy(text) {
  const el = document.getElementById("we-buy");
  if (!el) return;
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  el.innerHTML = lines
    .map((line) => `<li>${highlight(escapeHtml(line))}</li>`)
    .join("");
}

// подсветка ключевых слов в строках "Что мы покупаем"
function highlight(s) {
  return s
    .replace(/Epic/g, '<span class="rar rar-epic">Epic</span>')
    .replace(/Legendary/g, '<span class="rar rar-leg">Legendary</span>')
    .replace(/(\d[\d.,]*\s*\$?SOL)/g, "<b>$1</b>");
}

// К числу автоматически добавляем $SOL (если его ещё нет)
function formatPrice(v) {
  const s = String(v).trim();
  return /sol/i.test(s) ? s : s + " $SOL";
}

// Строка под названием: редкость, деталь, тип машины, тип товара
function cardMeta(p) {
  const parts = [];
  if (p.rarity && p.rarity !== "None") {
    const cls = p.rarity === "Legendary" ? "rar-leg" : "rar-epic";
    parts.push(`<span class="rar ${cls}">${p.rarity}</span>`);
  }
  if (p.partType && p.partType !== "None")
    parts.push(`<span>${escapeHtml(p.partType)}</span>`);
  if (p.carType && p.carType !== "None")
    parts.push(`<span>${escapeHtml(p.carType)}</span>`);
  if (p.productType && p.productType !== "None")
    parts.push(`<span>${escapeHtml(p.productType)}</span>`);
  return parts.length ? `<div class="prod-meta">${parts.join("")}</div>` : "";
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

load();
