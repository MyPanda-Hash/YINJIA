-- q-04-row9414-identity.sql — 定位 id 7535/9414 两行在各库的身份;并核 RESTORE 的来料检验数据分布
SET NOCOUNT ON;
SELECT DB_NAME() AS db, id, panel_code, col_name, label, place, seq, editable, visible, hidden
FROM yj_field WHERE id IN (7535, 9414);
GO
SELECT DB_NAME() AS db, COUNT(*) AS 来料检验行数 FROM yj_field WHERE panel_code = 'INV' AND col_name = N'来料检验';
GO
SELECT DB_NAME() AS db, [来料检验] AS 值, COUNT(*) AS 行数 FROM bs_inv GROUP BY [来料检验] ORDER BY 行数 DESC;
GO
SELECT DB_NAME() AS db, COUNT(*) AS 登记条数 FROM yj_schema_log WHERE script LIKE '%bs-inv-inspection%';
GO
