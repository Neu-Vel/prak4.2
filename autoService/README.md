# АвтоСервис

## Стек
- Backend: Node.js + Express
- БД: SQLite (better-sqlite3)
- Frontend: HTML + CSS + JavaScript (ванильный)

## Установка и запуск

```bash
cd autoService
npm install
npm start
```

Откройте в браузере: http://localhost:3000

## Тестовые аккаунты (из БД)

**Администратор**
- Логин: `Nikita`
- Пароль: `d3ff3f3a3r`

**Клиент**
- Логин: `Ivan`
- Пароль: `23235236`

## Функционал

### Клиент
- Регистрация / авторизация
- Добавление своих автомобилей (марка, модель, год, VIN)
- Просмотр услуг
- Создание заявки на ремонт (выбор авто + услуги)
- Просмотр своих заявок и статусов

### Администратор
- Всё то же, что у клиента
- Просмотр всех заявок
- Изменение статусов заявок: Новая заявка → Принята → В ремонте → Завершена / Отклонена
- Управление услугами (добавление / удаление)

## Структура проекта
```
autoService/
├── server.js          # Express API
├── СТО_DB             # SQLite база
├── package.json
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
└── README.md
```

## API (кратко)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/register | Регистрация |
| POST | /api/login | Вход |
| GET | /api/me | Текущий пользователь |
| GET | /api/services | Список услуг |
| POST/PUT/DELETE | /api/services[/:id] | Управление услугами (admin) |
| GET/POST/DELETE | /api/cars[/:id] | Автомобили пользователя |
| POST | /api/orders | Создать заявку |
| GET | /api/orders/my | Мои заявки |
| GET | /api/orders | Все заявки (admin) |
| PATCH | /api/orders/:id/status | Смена статуса (admin) |
