let allProducts = [];

async function load() {
  const products = await fetch("/api/products").then((r) => r.json());

  allProducts = products;
  document
    .getElementById("filter-rarity")
    .addEventListener("change", render);
  document.getElementById("filter-type").addEventListener("change", render);
  render();
}

function render() {
  const rarity = document.getElementById("filter-rarity").value;
  const type = document.getElementById("filter-type").value;

  const filtered = allProducts.filter(
    (p) =>
      (!rarity || (p.rarity || "None") === rarity) &&
      (!type || (p.carType || "None") === type)
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
}

function card(p) {
  const img = p.image
    ? `<img src="${p.image}" alt="" loading="lazy" />`
    : `<div class="no-image">нет фото</div>`;
  const price = p.price ? `<div class="price">${escapeHtml(p.price)}</div>` : "";
  const desc = p.description
    ? `<p class="desc">${escapeHtml(p.description)}</p>`
    : "";
  return `
    <article class="product">
      <div class="product-img">${img}${badges(p)}</div>
      <div class="product-body">
        <h3>${escapeHtml(p.title)}</h3>
        ${price}
        ${desc}
      </div>
    </article>`;
}

function badges(p) {
  const items = [];
  if (p.rarity && p.rarity !== "None")
    items.push(`<span class="badge rarity-${p.rarity}">${p.rarity}</span>`);
  if (p.carType && p.carType !== "None")
    items.push(`<span class="badge type">${escapeHtml(p.carType)}</span>`);
  return items.length ? `<div class="badges">${items.join("")}</div>` : "";
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
