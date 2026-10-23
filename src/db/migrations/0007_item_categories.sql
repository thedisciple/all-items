CREATE TABLE item_categories (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(length(trim(category)) > 0),
  PRIMARY KEY(item_id, category)
);
CREATE INDEX item_categories_category_item_idx ON item_categories(category, item_id);

-- items.category remains an immutable legacy snapshot; all active consumers use this relation.
-- SQLite lower() handles ASCII only; bounded CTE stages fold known Unicode aliases.
WITH n0 AS (SELECT id, category, lower(trim(category)) AS folded FROM items WHERE category IS NOT NULL AND trim(category) <> ''),
n1 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'Š', 'š'), 'А', 'а'), 'Б', 'б'), 'В', 'в'), 'Г', 'г') AS folded FROM n0),
n2 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'Д', 'д'), 'Е', 'е'), 'Ж', 'ж'), 'З', 'з'), 'И', 'и') AS folded FROM n1),
n3 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'Й', 'й'), 'К', 'к'), 'Л', 'л'), 'М', 'м'), 'Н', 'н') AS folded FROM n2),
n4 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'О', 'о'), 'П', 'п'), 'Р', 'р'), 'С', 'с'), 'Т', 'т') AS folded FROM n3),
n5 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'У', 'у'), 'Х', 'х'), 'Ц', 'ц'), 'Ч', 'ч'), 'Ш', 'ш') AS folded FROM n4),
n6 AS (SELECT id, category, replace(replace(replace(replace(replace(folded, 'Щ', 'щ'), 'Ы', 'ы'), 'Ь', 'ь'), 'Э', 'э'), 'Ю', 'ю') AS folded FROM n5),
n7 AS (SELECT id, category, replace(folded, 'Я', 'я') AS folded FROM n6)
INSERT INTO item_categories (item_id, category)
SELECT id, CASE
    WHEN folded IN ('electronics', 'электроника', 'электроника и компоненты', 'electronics') THEN 'electronics'
    WHEN folded IN ('computers', 'компьютеры', 'компьютеры и гаджеты', 'компьютерная техника', 'computers & gadgets') THEN 'computers'
    WHEN folded IN ('tools', 'инструменты', 'инструменты и оборудование', 'инструменты и техника', 'tools & equipment') THEN 'tools'
    WHEN folded IN ('antiques', 'антиквариат', 'антиквариат и коллекционирование', 'коллекционирование', 'antiques & collectibles') THEN 'antiques'
    WHEN folded IN ('clothing', 'одежда', 'одежда и обувь', 'обувь', 'clothing & shoes') THEN 'clothing'
    WHEN folded IN ('plants', 'растения', 'растения и сад', 'сад и огород', 'двор и сад', 'bašta i dvorište', 'plants & garden') THEN 'plants'
    WHEN folded IN ('home', 'дом и быт', 'дом и хозяйство', 'для дома', 'home & household') THEN 'home'
    WHEN folded IN ('books_hobbies', 'книги', 'книги и хобби', 'хобби и отдых', 'books & hobbies') THEN 'books_hobbies'
    WHEN folded IN ('sports', 'спорт', 'спорт и отдых', 'спорт и туризм', 'sports & outdoors') THEN 'sports'
    WHEN folded IN ('kids', 'детские вещи', 'детские товары', 'детские товары и игрушки', 'kids & baby') THEN 'kids'
    WHEN folded IN ('other', 'прочее', 'другое', 'other') THEN 'other'
    ELSE category END
FROM n7;
