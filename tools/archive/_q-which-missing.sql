SET NOCOUNT ON;
SELECT t.tbl,
       CASE WHEN COL_LENGTH('dbo.' + t.tbl, N'仓库') IS NULL THEN '缺仓库' ELSE '有仓库' END AS wh,
       CASE WHEN COL_LENGTH('dbo.' + t.tbl, N'仓库名称') IS NULL THEN '缺仓库名称' ELSE '有仓库名称' END AS whn
  FROM (VALUES (N'bl_sale_out'), (N'bl_purchase_in'), (N'bl_so_order')) t(tbl);
GO
