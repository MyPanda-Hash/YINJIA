-- 导出 MES 档案:物料编码 → 名称,仓库编码 → 名称(供 Excel 补全,只读)
SET NOCOUNT ON;
SELECT 'INV' AS k, 存货编码 AS code, 存货名称 AS name FROM bs_inv;
GO
SELECT 'WH' AS k, 仓库编码 AS code, 仓库名称 AS name FROM bs_wh;
GO
