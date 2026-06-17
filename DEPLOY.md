# Деплой на бесплатный хостинг (Render + Cloudinary + Upstash)

Итог: сайт будет доступен по адресу вида `https://store-for-racers.onrender.com`,
фото хранятся в Cloudinary, товары и тексты — в Upstash Redis. Всё на бесплатных тарифах.

Понадобится 4 бесплатных аккаунта. Карта нигде не нужна.

---

## Шаг 1. Cloudinary (хранение фото)

1. Зарегистрируйся на https://cloudinary.com (Sign up, можно через Google).
2. На главной странице дашборда найди блок **API Environment variable** —
   там строка вида:
   ```
   CLOUDINARY_URL=cloudinary://123456789:abcdEFGhijK@dxxxxxx
   ```
3. Скопируй её целиком — пригодится на шаге 4.

## Шаг 2. Upstash Redis (хранение товаров и текстов)

1. Зарегистрируйся на https://upstash.com (через Google/GitHub).
2. Create Database → имя любое, тип **Redis**, регион поближе (Europe).
3. Открой базу, прокрути до раздела **REST API** и скопируй два значения:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Шаг 3. GitHub (хранилище кода для Render)

1. Зарегистрируйся на https://github.com (если ещё нет).
2. Создай новый пустой репозиторий (New repository), имя например `store-for-racers`,
   **без** README/gitignore. Скопируй его адрес вида
   `https://github.com/ТВОЙ_ЛОГИН/store-for-racers.git`.
3. Дай мне этот адрес — я залью код одной командой. (Или см. ручные команды внизу.)

## Шаг 4. Render (сам хостинг)

1. Зарегистрируйся на https://render.com через **GitHub** (Sign in with GitHub).
2. New + → **Web Service** → выбери свой репозиторий `store-for-racers`.
3. Настройки подтянутся из `render.yaml`. Тариф — **Free**.
4. Открой вкладку **Environment** и добавь переменные (Add Environment Variable):
   | Ключ | Значение |
   |------|----------|
   | `ADMIN_PASSWORD` | твой пароль для входа в админку |
   | `CLOUDINARY_URL` | строка из шага 1 |
   | `UPSTASH_REDIS_REST_URL` | из шага 2 |
   | `UPSTASH_REDIS_REST_TOKEN` | из шага 2 |

   (`SESSION_SECRET` Render создаст сам.)
5. Create Web Service → подожди 1–2 минуты, пока соберётся.
6. Готово: сайт по адресу `https://ИМЯ.onrender.com`, админка `/admin`.

---

## Важно знать

- **Товары начнутся с нуля.** Локальные товары остаются на твоём компьютере;
  в облаке база пустая — добавишь товары заново через админку на живом сайте.
- **Бесплатный Render «засыпает»** после ~15 минут без посещений. Первый заход
  после простоя грузится ~30 секунд, дальше быстро.
- **Своё доменное имя** (типа `store-for-racers.com`) можно прикрепить позже —
  поддомен `.onrender.com` бесплатный и работает сразу.

## Ручная заливка кода на GitHub (если не через меня)

В PowerShell в папке проекта:
```
git remote add origin https://github.com/ТВОЙ_ЛОГИН/store-for-racers.git
git push -u origin main
```
