SET NOCOUNT ON;
-- qc_insp_detail:Java代码要查 仓库代码 列,检查是否存在
SELECT CASE WHEN COL_LENGTH('dbo.qc_insp_detail', N'仓库代码') IS NOT NULL THEN 1 ELSE 0 END AS has_warehouse_code;
SELECT CASE WHEN COL_LENGTH('dbo.qc_insp_detail', N'型号') IS NOT NULL THEN 1 ELSE 0 END AS has_model;
SELECT CASE WHEN COL_LENGTH('dbo.qc_insp_detail', N'数量') IS NOT NULL THEN 1 ELSE 0 END AS has_qty;
-- sl_recv 的明细表
SELECT CASE WHEN OBJECT_ID('dbo.sl_recv_detail') IS NOT NULL THEN 1 ELSE 0 END AS has_detail_table;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.sl_recv_detail') ORDER BY c.column_id;
