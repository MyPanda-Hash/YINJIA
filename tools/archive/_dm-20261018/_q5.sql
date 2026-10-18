SET NOCOUNT ON;
SELECT COUNT(*) 商品数 FROM bs_inv;
SELECT c.name, c.max_length, t.name 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bs_inv') AND (c.name LIKE '%金蝶%' OR c.name LIKE '%ERP%' OR c.name LIKE '%king%') ORDER BY c.column_id;
SELECT TOP 1 * FROM bs_inv;
SELECT COUNT(*) 仓库 FROM bs_wh;
SELECT COUNT(DISTINCT 仓库编码) 仓库编码数 FROM kucun;
