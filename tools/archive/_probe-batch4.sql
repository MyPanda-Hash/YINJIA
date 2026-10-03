SET NOCOUNT ON;
GO
PRINT '=== 所有 editable=0 的明细字段(前端的预览影响面) ===';
SELECT panel_code, place, seq, label, col_name, data_type
FROM yj_field WHERE place = N'detail' AND ISNULL(editable,1) = 0
ORDER BY panel_code, seq;
GO
PRINT '=== 采购链四单 全部字段(确认明细列注册) ===';
SELECT panel_code, place, seq, label, col_name, data_type, editable, visible, hidden
FROM yj_field
WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'PURCHASE_IN', N'QC_RETURN')
  AND label IN (N'批次号', N'批次键', N'供应商代码', N'供应商编码', N'供应商', N'单据日期', N'日期')
ORDER BY panel_code, place, seq;
GO
