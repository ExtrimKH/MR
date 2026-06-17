const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1); // за прокси хостинга (Render)

// ---- Настройки ----
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // ПОМЕНЯЙ пароль!
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(16).toString("hex");

// Убирает частые ошибки вставки: пробелы, кавычки и случайный префикс "ИМЯ=".
function cleanEnv(name) {
  let v = (process.env[name] || "").trim();
  if (v.startsWith(name + "=")) v = v.slice(name.length + 1).trim();
  v = v.replace(/^["']|["']$/g, "").trim();
  return v;
}

// Облачные хранилища включаются, только если заданы переменные окружения.
// Если их нет — работаем локально (фото на диске, данные в data/db.json).
const CLOUDINARY_URL = cleanEnv("CLOUDINARY_URL");
const REDIS_URL = cleanEnv("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = cleanEnv("UPSTASH_REDIS_REST_TOKEN");
const DATA_KEY = process.env.DATA_KEY || "vizov:db";

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

let USE_CLOUDINARY = CLOUDINARY_URL.startsWith("cloudinary://");
let USE_REDIS = !!REDIS_URL && !!REDIS_TOKEN;

let cloudinary = null;
if (USE_CLOUDINARY) {
  try {
    process.env.CLOUDINARY_URL = CLOUDINARY_URL; // нормализованное значение для SDK
    cloudinary = require("cloudinary").v2;
  } catch (e) {
    console.error("Cloudinary отключён (ошибка конфигурации):", e.message);
    cloudinary = null;
    USE_CLOUDINARY = false;
  }
} else if (CLOUDINARY_URL) {
  console.error(
    "CLOUDINARY_URL задан, но не начинается с 'cloudinary://' — фото будут на диске. Проверь значение."
  );
}

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---- База данных (локально файл / в облаке Upstash Redis) ----
function defaultDB() {
  return {
    products: [],
    info: {
      howItWorks:
        "Опишите здесь, как работает сервис: что вы делаете, сроки, условия.",
      whereToSend: "Укажите здесь адрес или контакт, куда отправлять машину.",
      weBuy:
        "Любая Epic запчасть — 0.01 $SOL\nЛюбая Legendary запчасть — 0.025 $SOL\nЛюбая машина Rare+ редкости — 0.15 $SOL",
    },
  };
}

async function redisCommand(cmd) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REDIS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error("Redis error " + res.status);
  return res.json();
}

async function loadDB() {
  if (USE_REDIS) {
    const r = await redisCommand(["GET", DATA_KEY]);
    return r.result ? JSON.parse(r.result) : defaultDB();
  }
  if (!fs.existsSync(DB_FILE)) return defaultDB();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

async function saveDB(database) {
  if (USE_REDIS) {
    await redisCommand(["SET", DATA_KEY, JSON.stringify(database)]);
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), "utf8");
}

let db = defaultDB(); // заполнится в init()

// ---- Хранение картинок (локально диск / в облаке Cloudinary) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 МБ
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Можно загружать только изображения"));
  },
});

async function storeImage(file) {
  if (!file) return { url: null, id: null };
  if (USE_CLOUDINARY) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "vizov" },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, id: result.public_id };
  }
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const name = crypto.randomBytes(8).toString("hex") + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), file.buffer);
  return { url: "/uploads/" + name, id: null };
}

async function deleteImage(product) {
  if (!product) return;
  if (product.imageId && USE_CLOUDINARY) {
    try {
      await cloudinary.uploader.destroy(product.imageId);
    } catch (_) {}
    return;
  }
  if (product.image && product.image.startsWith("/uploads/")) {
    const file = path.join(__dirname, product.image);
    if (file.startsWith(UPLOADS_DIR) && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (_) {}
    }
  }
}

// ---- Middleware ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12 часов
      httpOnly: true, // cookie недоступна из JavaScript (защита от XSS-кражи)
      sameSite: "lax", // защита от CSRF
      secure: "auto", // только по HTTPS на хостинге, но работает и локально
    },
  })
);

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Требуется вход" });
}

// ---- Защита входа от перебора пароля ----
const loginAttempts = new Map(); // ip -> { count, first, blockedUntil }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000; // 15 минут

function loginLimiter(req, res, next) {
  const rec = loginAttempts.get(req.ip);
  if (rec && rec.blockedUntil && Date.now() < rec.blockedUntil) {
    const mins = Math.ceil((rec.blockedUntil - Date.now()) / 60000);
    return res
      .status(429)
      .json({ error: `Слишком много попыток. Подождите ${mins} мин.` });
  }
  next();
}

function recordFail(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    rec = { count: 0, first: now, blockedUntil: 0 };
  }
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) rec.blockedUntil = now + WINDOW_MS;
  loginAttempts.set(ip, rec);
}

const RARITIES = ["None", "Epic", "Legendary"];
const CAR_TYPES = ["None", "Road", "Sport", "Muscle", "Vintage"];
const PRODUCT_TYPES = ["None", "Машина", "Деталь", "Карточка"];
const PART_TYPES = [
  "None",
  "Roof",
  "Headlights",
  "Grill",
  "Rims",
  "Hood",
  "Sideskirts",
  "Mirrors",
  "Fenders",
  "Bumper",
  "Wing",
];

function normalize(value, allowed) {
  const v = (value || "").trim();
  return allowed.includes(v) ? v : allowed[0]; // по умолчанию "None"
}

// Обёртка, чтобы ошибки из async-обработчиков попадали в общий handler
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Лёгкая проверка живости (для аптайм-монитора, чтобы сайт не засыпал)
app.get("/ping", (req, res) => res.type("text").send("ok"));

// ---- Публичные API ----
app.get("/api/products", (req, res) => {
  res.json(db.products.filter((p) => !p.hidden));
});

app.get("/api/admin/products", requireAuth, (req, res) => {
  res.json(db.products);
});

app.get("/api/info", (req, res) => {
  res.json(db.info);
});

// ---- Вход в админку ----
app.post("/api/login", loginLimiter, (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    loginAttempts.delete(req.ip); // сброс при успехе
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  recordFail(req.ip);
  res.status(401).json({ error: "Неверный пароль" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---- Управление товарами (только админ) ----
app.post(
  "/api/products",
  requireAuth,
  upload.single("image"),
  wrap(async (req, res) => {
    const { title, price, description, rarity, carType, productType, partType } =
      req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Укажите название товара" });
    }
    const img = await storeImage(req.file);
    const product = {
      id: crypto.randomBytes(8).toString("hex"),
      title: title.trim(),
      price: (price || "").trim(),
      description: (description || "").trim(),
      rarity: normalize(rarity, RARITIES),
      carType: normalize(carType, CAR_TYPES),
      productType: normalize(productType, PRODUCT_TYPES),
      partType: normalize(partType, PART_TYPES),
      hidden: false,
      image: img.url,
      imageId: img.id,
      createdAt: Date.now(),
    };
    db.products.unshift(product);
    await saveDB(db);
    res.json(product);
  })
);

app.put(
  "/api/products/:id",
  requireAuth,
  upload.single("image"),
  wrap(async (req, res) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Товар не найден" });

    const { title, price, description, rarity, carType, productType, partType } =
      req.body;
    if (title !== undefined) product.title = title.trim();
    if (price !== undefined) product.price = price.trim();
    if (description !== undefined) product.description = description.trim();
    if (rarity !== undefined) product.rarity = normalize(rarity, RARITIES);
    if (carType !== undefined) product.carType = normalize(carType, CAR_TYPES);
    if (productType !== undefined)
      product.productType = normalize(productType, PRODUCT_TYPES);
    if (partType !== undefined)
      product.partType = normalize(partType, PART_TYPES);
    if (req.file) {
      await deleteImage(product);
      const img = await storeImage(req.file);
      product.image = img.url;
      product.imageId = img.id;
    }
    await saveDB(db);
    res.json(product);
  })
);

app.post(
  "/api/products/:id/toggle-hidden",
  requireAuth,
  wrap(async (req, res) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Товар не найден" });
    product.hidden = !product.hidden;
    await saveDB(db);
    res.json(product);
  })
);

app.delete(
  "/api/products/:id",
  requireAuth,
  wrap(async (req, res) => {
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Товар не найден" });
    await deleteImage(db.products[idx]);
    db.products.splice(idx, 1);
    await saveDB(db);
    res.json({ ok: true });
  })
);

app.put(
  "/api/info",
  requireAuth,
  wrap(async (req, res) => {
    const { howItWorks, whereToSend, weBuy } = req.body;
    if (howItWorks !== undefined) db.info.howItWorks = howItWorks;
    if (whereToSend !== undefined) db.info.whereToSend = whereToSend;
    if (weBuy !== undefined) db.info.weBuy = weBuy;
    await saveDB(db);
    res.json(db.info);
  })
);

// ---- Обработка ошибок ----
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ---- Старт ----
async function init() {
  db = await loadDB();
  // Дозаполняем новые поля для уже существующих баз
  if (db.info && db.info.weBuy === undefined) {
    db.info.weBuy = defaultDB().info.weBuy;
  }
  await saveDB(db); // создаём запись/файл, если его не было
  app.listen(PORT, () => {
    console.log(`\n  Сайт запущен:  http://localhost:${PORT}`);
    console.log(`  Админка:       http://localhost:${PORT}/admin`);
    console.log(`  Пароль админа: ${ADMIN_PASSWORD}`);
    console.log(
      `  Хранилище: фото — ${USE_CLOUDINARY ? "Cloudinary" : "диск"}, данные — ${
        USE_REDIS ? "Upstash Redis" : "файл"
      }\n`
    );
  });
}

init();
