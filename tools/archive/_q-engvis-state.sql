/* migrate-fix-all-english-and-visibility.sql 撞墙探因:bd_purchase_in / bd_sale_out 的 id 类列现状 + 登记史 */
SET NOCOUNT ON;
SELECT c.name AS 列名 FROM sys.columns c
 WHERE c.object_id IN (OBJECT_ID('bd_purchase_in'), OBJECT_ID('bd_sale_out'))
   AND (c.name LIKE '%id' OR c.name LIKE '%id%' AND c.name NOT LIKE 'asp%')
 ORDER BY OBJECT_NAME(c.object_id), c.name;
GO
PRINT '== 该表上的索引/约束(名字含 id 或 客户) ==';
SELECT i.name, OBJECT_NAME(i.object_id) AS 表, i.type_desc
  FROM sys.indexes i
 WHERE i.object_id IN (OBJECT_ID('bd_purchase_in'), OBJECT_ID('bd_sale_out'));
GO
PRINT '== yj_schema_log 登记 ==';
SELECT script_name, LEFT(content_hash,12) AS hash12, applied_at FROM yj_schema_log
 WHERE script_name IN (N'migrate-fix-all-english-and-visibility.sql', N'migrate-fix-all-english.sql');
GO
