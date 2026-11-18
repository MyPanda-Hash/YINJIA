SET NOCOUNT ON;
SELECT 'HSDZ_MES' AS db, COUNT(*) AS rows_no FROM bl_pu_order WHERE 单据编号 = N'YJ-20261111-06';
GO
SELECT 'HSDZ_MES' AS db, COUNT(*) AS rows_id FROM bl_pu_order WHERE id = 11039;
GO
SELECT TOP 5 id, 单据编号, 行号, 物料编码, 数量 FROM bl_pu_order ORDER BY id DESC;
