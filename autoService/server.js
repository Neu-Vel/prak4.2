const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Database
const dbPath = path.join(__dirname, "СТО_DB");
const db = new Database(dbPath);
console.log("База данных подключена:", dbPath);

// Simple token helpers (educational, not production-grade)
function createToken(user) {
  const payload = `${user.id}:${user.role}:${user.login}`;
  return Buffer.from(payload).toString("base64");
}

function parseToken(token) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [id, role, login] = decoded.split(":");
    return { id: parseInt(id, 10), role, login };
  } catch {
    return null;
  }
}

// Auth middleware
function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const user = parseToken(token);
  if (!user || !user.id) {
    return res.status(401).json({ error: "Недействительный токен" });
  }
  const row = db.prepare("SELECT id, login, role FROM users WHERE id = ?").get(user.id);
  if (!row) {
    return res.status(401).json({ error: "Пользователь не найден" });
  }
  req.user = row;
  next();
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Доступ только для администратора" });
  }
  next();
}

// AUTH 
app.post("/api/register", (req, res) => {
  try {
    const { login, password, phone_number, email } = req.body;
    if (!login || !password || !phone_number) {
      return res.status(400).json({ error: "Логин, пароль и телефон обязательны" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Пароль должен быть не короче 4 символов" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE login = ? OR phone_number = ?").get(login, phone_number);
    if (existing) {
      return res.status(400).json({ error: "Пользователь с таким логином или телефоном уже существует" });
    }

    const result = db.prepare(
      "INSERT INTO users (login, password, phone_number, email, role) VALUES (?, ?, ?, ?, 'client')"
    ).run(login, password, phone_number, email || null);

    const user = { id: result.lastInsertRowid, login, role: "client" };
    const token = createToken(user);
    res.status(201).json({ message: "Регистрация успешна", user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера при регистрации" });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: "Логин и пароль обязательны" });
    }

    const user = db.prepare("SELECT id, login, role, password FROM users WHERE login = ?").get(login);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const token = createToken(user);
    res.json({
      message: "Успешный вход",
      user: { id: user.id, login: user.login, role: user.role },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера при входе" });
  }
});

app.get("/api/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

// SERVICES
app.get("/api/services", (req, res) => {
  try {
    const services = db.prepare("SELECT id, title, description, price FROM services ORDER BY id").all();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения услуг" });
  }
});

app.post("/api/services", authRequired, adminRequired, (req, res) => {
  try {
    const { title, description, price } = req.body;
    if (!title || price === undefined || price === null) {
      return res.status(400).json({ error: "Название и цена обязательны" });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: "Цена должна быть неотрицательным числом" });
    }

    const result = db.prepare(
      "INSERT INTO services (title, description, price) VALUES (?, ?, ?)"
    ).run(title, description || null, numPrice);

    const service = db.prepare("SELECT * FROM services WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка добавления услуги" });
  }
});

app.put("/api/services/:id", authRequired, adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, price } = req.body;
    const existing = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Услуга не найдена" });
    }

    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newPrice = price !== undefined ? Number(price) : existing.price;

    if (isNaN(newPrice) || newPrice < 0) {
      return res.status(400).json({ error: "Цена должна быть неотрицательным числом" });
    }

    db.prepare("UPDATE services SET title = ?, description = ?, price = ? WHERE id = ?")
      .run(newTitle, newDesc, newPrice, id);

    const service = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка обновления услуги" });
  }
});

app.delete("/api/services/:id", authRequired, adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Услуга не найдена" });
    }

    const used = db.prepare("SELECT id FROM orders WHERE service_id = ? LIMIT 1").get(id);
    if (used) {
      return res.status(400).json({ error: "Нельзя удалить услугу, по которой есть заявки" });
    }

    db.prepare("DELETE FROM services WHERE id = ?").run(id);
    res.json({ message: "Услуга удалена" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления услуги" });
  }
});

// CARS
app.get("/api/cars", authRequired, (req, res) => {
  try {
    const cars = db.prepare(
      "SELECT id, brand, model, year, vin FROM cars WHERE user_id = ? ORDER BY id"
    ).all(req.user.id);
    res.json(cars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения автомобилей" });
  }
});

app.post("/api/cars", authRequired, (req, res) => {
  try {
    const { brand, model, year, vin } = req.body;
    if (!brand || !model || !year || !vin) {
      return res.status(400).json({ error: "Все поля автомобиля обязательны" });
    }
    const numYear = parseInt(year, 10);
    if (isNaN(numYear) || numYear < 1900 || numYear > new Date().getFullYear() + 1) {
      return res.status(400).json({ error: "Некорректный год выпуска" });
    }

    const existingVin = db.prepare("SELECT id FROM cars WHERE vin = ?").get(vin);
    if (existingVin) {
      return res.status(400).json({ error: "Автомобиль с таким VIN уже зарегистрирован" });
    }

    const result = db.prepare(
      "INSERT INTO cars (user_id, brand, model, year, vin) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.id, brand, model, numYear, vin);

    const car = db.prepare("SELECT id, brand, model, year, vin FROM cars WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(car);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка добавления автомобиля" });
  }
});

app.delete("/api/cars/:id", authRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const car = db.prepare("SELECT * FROM cars WHERE id = ? AND user_id = ?").get(id, req.user.id);
    if (!car) {
      return res.status(404).json({ error: "Автомобиль не найден" });
    }

    const used = db.prepare("SELECT id FROM orders WHERE car_id = ? LIMIT 1").get(id);
    if (used) {
      return res.status(400).json({ error: "Нельзя удалить автомобиль, по которому есть заявки" });
    }

    db.prepare("DELETE FROM cars WHERE id = ?").run(id);
    res.json({ message: "Автомобиль удалён" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка удаления автомобиля" });
  }
});

// ORDERS
app.post("/api/orders", authRequired, (req, res) => {
  try {
    const { car_id, service_id, description } = req.body;
    if (!car_id || !service_id) {
      return res.status(400).json({ error: "Автомобиль и услуга обязательны" });
    }

    const car = db.prepare("SELECT id FROM cars WHERE id = ? AND user_id = ?").get(car_id, req.user.id);
    if (!car) {
      return res.status(400).json({ error: "Автомобиль не найден или не принадлежит вам" });
    }

    const service = db.prepare("SELECT id FROM services WHERE id = ?").get(service_id);
    if (!service) {
      return res.status(400).json({ error: "Услуга не найдена" });
    }

    const result = db.prepare(
      `INSERT INTO orders (user_id, car_id, service_id, description, status)
       VALUES (?, ?, ?, ?, 'Новая заявка')`
    ).run(req.user.id, car_id, service_id, description || null);

    const order = db.prepare(`
      SELECT o.id, o.status, o.description, o.created_at,
             s.title as service_title, s.price as service_price,
             c.brand, c.model, c.year, c.vin
      FROM orders o
      JOIN services s ON s.id = o.service_id
      JOIN cars c ON c.id = o.car_id
      WHERE o.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка создания заявки" });
  }
});

app.get("/api/orders/my", authRequired, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.status, o.description, o.created_at,
             s.title as service_title, s.price as service_price,
             c.brand, c.model, c.year, c.vin
      FROM orders o
      JOIN services s ON s.id = o.service_id
      JOIN cars c ON c.id = o.car_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения заявок" });
  }
});

app.get("/api/orders", authRequired, adminRequired, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.status, o.description, o.created_at,
             s.title as service_title, s.price as service_price,
             c.brand, c.model, c.year, c.vin,
             u.login as user_login, u.phone_number as user_phone
      FROM orders o
      JOIN services s ON s.id = o.service_id
      JOIN cars c ON c.id = o.car_id
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `).all();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка получения заявок" });
  }
});

app.patch("/api/orders/:id/status", authRequired, adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const allowed = ["Новая заявка", "Принята", "В ремонте", "Завершена", "Отклонена"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: "Недопустимый статус. Допустимые: " + allowed.join(", ") });
    }

    const existing = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }

    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);

    const order = db.prepare(`
      SELECT o.id, o.status, o.description, o.created_at,
             s.title as service_title, s.price as service_price,
             c.brand, c.model, c.year, c.vin,
             u.login as user_login, u.phone_number as user_phone
      FROM orders o
      JOIN services s ON s.id = o.service_id
      JOIN cars c ON c.id = o.car_id
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `).get(id);

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка изменения статуса" });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
