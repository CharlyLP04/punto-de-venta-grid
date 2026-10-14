ALTER TABLE products ADD COLUMN cost_known INTEGER NOT NULL DEFAULT 0 CHECK(cost_known IN (0,1));
UPDATE products SET cost_known=1 WHERE cost>0;
CREATE TABLE common_cart(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket INTEGER NOT NULL CHECK(ticket BETWEEN 1 AND 5),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 100000000),
  cost INTEGER CHECK(cost BETWEEN 0 AND 100000000)
);
DROP VIEW sale_metrics;
CREATE VIEW sale_metrics AS
SELECT s.id AS sale,s.created,s.user_id,s.total AS revenue,
 coalesce((SELECT sum(json_extract(j.value,'$.cost')) FROM json_each(s.receipt,'$.items') j),0) AS cost,
 (SELECT count(*) FROM json_each(s.receipt,'$.items') j WHERE coalesce(json_extract(j.value,'$.cost_known'),json_extract(j.value,'$.cost')>0,0)=0) AS missing_cost
FROM sales s
UNION ALL
SELECT s.id,r.created,r.user_id,-s.total,
 -coalesce((SELECT sum(json_extract(j.value,'$.cost')) FROM json_each(r.receipt,'$.items') j),0),
 (SELECT count(*) FROM json_each(r.receipt,'$.items') j WHERE coalesce(json_extract(j.value,'$.cost_known'),json_extract(j.value,'$.cost')>0,0)=0)
FROM refunds r JOIN sales s ON s.id=r.sale;
DROP VIEW item_metrics;
CREATE VIEW item_metrics AS
SELECT json_extract(j.value,'$.id') AS product,json_extract(j.value,'$.name') AS name,
 CASE WHEN coalesce(json_extract(j.value,'$.cost_known'),json_extract(j.value,'$.cost')>0,0)=1
 THEN json_extract(j.value,'$.subtotal')-json_extract(j.value,'$.cost') END AS margin,s.created
FROM sales s,json_each(s.receipt,'$.items') j
UNION ALL
SELECT json_extract(j.value,'$.id'),json_extract(j.value,'$.name'),
 CASE WHEN coalesce(json_extract(j.value,'$.cost_known'),json_extract(j.value,'$.cost')>0,0)=1
 THEN -(json_extract(j.value,'$.subtotal')-json_extract(j.value,'$.cost')) END,r.created
FROM refunds r,json_each(r.receipt,'$.items') j;
PRAGMA user_version=6;
