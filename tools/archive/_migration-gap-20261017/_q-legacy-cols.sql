SET NOCOUNT ON;
SELECT t.name AS tbl, c.column_id AS ord, c.name AS col, ty.name AS typ,
       c.max_length AS len, c.precision AS prec, c.scale AS sc,
       c.is_nullable AS nullable, c.is_identity AS ident
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('dm_langue','gscs','permission','s_commdata','s_sys','s_xtcs')
ORDER BY t.name, c.column_id;

SELECT t.name AS tbl, c.name AS col
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('dm_langue','gscs','permission','s_commdata','s_sys','s_xtcs')
  AND (c.name LIKE '%pass%' OR c.name LIKE '%pwd%' OR c.name LIKE '%secret%' OR c.name LIKE '%key%'
       OR c.name LIKE '%token%' OR c.name LIKE '%mm%' OR c.name LIKE '%kl%' OR c.name LIKE '%pwd%');
