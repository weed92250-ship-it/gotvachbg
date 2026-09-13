CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE,
  title TEXT NOT NULL,
  title_en TEXT,
  excerpt TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  category TEXT NOT NULL,
  area TEXT NOT NULL,
  diet_tags TEXT NOT NULL DEFAULT '',
  image TEXT,
  youtube TEXT,
  author TEXT NOT NULL DEFAULT 'Готвач БГ',
  date TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  date TEXT NOT NULL
);

INSERT INTO recipes (id, source_id, title, title_en, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured) VALUES
('r1', 'seed1', 'Класическа маргарита пица', 'Classic Margherita Pizza', 'Проста италианска класика с домат, моцарела и босилек.', '[{"name":"брашно","measure":"500 г"},{"name":"доматен сос","measure":"200 мл"},{"name":"моцарела","measure":"250 г"},{"name":"пресен босилек","measure":"по вкус"}]', 'Замесете тестото и оставете да втаса 1 час.\n\nРазточете тестото и намажете с доматен сос.\n\nДобавете моцарела и печете на 220°C за 12-15 минути.\n\nГарнирайте с пресен босилек преди сервиране.', 'Основно ястие', 'Италианска', 'вегетарианско', 'https://www.themealdb.com/images/media/meals/x0lk931587671540.jpg', '', 'Готвач БГ', '2026-09-01', 1);
