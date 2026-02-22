# WEBHOOD — Инструкция по деплою

## Структура файлов

```
webhood/
├── index.html          ← главная страница (только HTML, без скриптов)
├── firestore.rules     ← правила безопасности Firebase
├── css/
│   └── style.css       ← все стили
└── js/
    ├── app.js          ← точка входа, всё связывает
    ├── firebase.js     ← Firebase (изолирован, не виден из консоли)
    ├── auth.js         ← регистрация, вход, сессии
    ├── admin.js        ← панель администратора
    ├── profile.js      ← просмотр профиля, комментарии, музыка
    ├── dashboard.js    ← редактирование профиля, темы
    ├── explore.js      ← страница поиска профилей
    ├── landing.js      ← статистика главной страницы
    └── utils.js        ← вспомогательные функции
```

---

## Шаг 1 — Firebase Security Rules

**Это самый важный шаг. Без него база данных открыта для всех.**

1. Открой [console.firebase.google.com](https://console.firebase.google.com)
2. Проект `webhood-4469e` → **Firestore Database** → вкладка **Rules**
3. Скопируй содержимое файла `firestore.rules` и вставь в редактор
4. Нажми **Publish**

После этого удалить всех пользователей из консоли браузера будет невозможно.

---

## Шаг 2 — Сменить пароль администратора

В файле `js/admin.js` найди строку:

```js
const ADMIN_HASH = "ЗАМЕНИ_НА_СВОЙ_ХЭШ";
```

Чтобы получить хэш своего пароля:

1. Открой любой HTTPS-сайт
2. Открой консоль браузера (F12)
3. Вставь и выполни:

```js
const SALT = "wh_admin_s4lt_v2";
const pass = "твой_пароль_здесь";
const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + pass + SALT));
console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join(""));
```

4. Скопируй полученный хэш и вставь вместо `ЗАМЕНИ_НА_СВОЙ_ХЭШ`

---

## Шаг 3 — Деплой на GitHub Pages

GitHub Pages требует, чтобы файлы были в репозитории.

> ⚠️ **Важно:** GitHub Pages работает только через HTTPS, что нужно для `crypto.subtle` (хэширование паролей).

```bash
# Создай репозиторий на github.com, затем:
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/ТВОЙ_НИК/РЕПОЗИТОРИЙ.git
git push -u origin main
```

Затем в GitHub:
- Settings → Pages → Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
- Нажми Save

Сайт будет доступен по адресу: `https://ТВОЙ_НИК.github.io/РЕПОЗИТОРИЙ/`

---

## Шаг 4 — Разрешить метаданные (бейджики) из admin panel

По умолчанию `firestore.rules` запрещает запись в коллекцию `meta` через клиент.
Это значит что создание бейджиков из admin panel не будет работать.

Для включения — в `firestore.rules` замени:

```js
match /meta/{docId} {
  allow read: if true;
  allow write: if false;  // ← это
```

на:

```js
match /meta/{docId} {
  allow read: if true;
  allow write: if true;  // ← временно разрешить
```

Это временное решение. Правильное — использовать Firebase Admin SDK на бэкенде.

---

## Что изменилось в безопасности

| До | После |
|---|---|
| `window._db`, `window._fbDeleteDoc` и т.д. — доступны из консоли | Firebase полностью изолирован в замыкании модуля |
| Пароль можно было взломать через rainbow tables | Пароли хранятся с солью `SHA-256(SALT + pass + SALT)` |
| Старые пароли без соли | Автоматическая миграция при входе |
| Хэш пароля администратора без соли | Хэш с отдельной солью для admin |
| Нет Firebase Rules | Rules запрещают удаление, защищают поля verified/banned |
| Один файл 4000 строк | 9 модульных файлов, каждый отвечает за своё |

---

## Как открыть admin panel

Зажми **Shift** и кликни на логотип **HOOD** в шапке.
