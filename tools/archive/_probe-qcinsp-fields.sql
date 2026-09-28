SET NOCOUNT ON;
-- 1. 面板
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code='QC_INSP';
GO
-- 2. QC_INSP 全部字段(含 hidden/visible/alias/ref)
SELECT id, place, seq, col_name, label, data_type, hidden, visible, alias, ref_panel, ref_field, editable, required FROM yj_field WHERE panel_code='QC_INSP' ORDER BY place, seq, id;
GO
-- 3. header 相关重复标签
SELECT label, COUNT(*) cnt FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' GROUP BY label HAVING COUNT(*)>1;
GO
-- 4. qc_insp 头表列
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp' ORDER BY ORDINAL_POSITION;
GO
-- 5. 头表列数
SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp';
SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail';
GO
