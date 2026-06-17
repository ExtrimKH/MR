let allProducts = [];

async function load() {
  const [products, info] = await Promise.all([
    fetch("/api/products").then((r) => r.json()),
    fetch("/api/info").then((r) => r.json()),
  ]);

  renderWeBuy(info.weBuy || "");

  allProducts = products;
  ["filter-rarity", "filter-type", "filter-product", "filter-part", "sort"].forEach(
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

  const sort = document.getElementById("sort").value;
  if (sort === "price-asc" || sort === "price-desc") {
    const num = (v) => {
      const n = parseFloat(String(v || "").replace(",", "."));
      return isNaN(n) ? null : n;
    };
    filtered.sort((a, b) => {
      const na = num(a.price);
      const nb = num(b.price);
      if (na === null && nb === null) return 0;
      if (na === null) return 1; // без цены — в конец
      if (nb === null) return -1;
      return sort === "price-asc" ? na - nb : nb - na;
    });
  }

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
}

function card(p, i = 0) {
  const delay = Math.min(i, 14) * 0.04; // лёгкий каскад появления
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
    <article class="product ${rcls}" style="animation-delay:${delay}s">
      <div class="product-img">${img}</div>
      <div class="product-body">
        <h3>${escapeHtml(p.title)}</h3>
        ${cardMeta(p)}
        ${price}
        ${desc}
      </div>
    </article>`;
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
