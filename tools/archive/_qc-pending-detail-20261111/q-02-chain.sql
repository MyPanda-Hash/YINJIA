SET NOCOUNT ON;
PRINT N'=== A. qc_insp_detail 列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_detail') ORDER BY c.column_id;

PRINT N'=== B. qc_insp 头列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp') ORDER BY c.column_id;

PRINT N'=== C. qc_insp_rec_detail 列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_rec_detail') ORDER BY c.column_id;

PRINT N'=== D. 品质/采购相关面板与表 ===';
SELECT panel_code, panel_name, mode, head_table, line_table, prefix, page_size FROM yj_panel
WHERE head_table IN (N'qc_recv', N'purchase_in', N'po_order', N'purchase_order', N'qc_return', N'qc_insp_rec')
   OR panel_code IN (N'QC_RECV', N'PURCHASE_IN', N'QC_RETURN') ORDER BY panel_code;

PRINT N'=== E. 含「采购订单」列的物理表(找链上的来源列) ===';
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE c.name IN (N'采购订单号', N'采购订单行号', N'送料暂收单号', N'暂收单号', N'采购入库单号', N'来料检验单号', N'行号')
  AND t.name LIKE N'%qc%' OR t.name LIKE N'%purchase%' OR t.name LIKE N'%recv%' ORDER BY t.name, c.name;
