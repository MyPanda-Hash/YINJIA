SET NOCOUNT ON;
PRINT N'===== yj_field: QC_INSP_REC (place=detail) =====';
SELECT id, col_name, label, place, seq, visible, hidden, editable, data_type
  FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND place = N'detail' ORDER BY seq, id;
PRINT N'===== yj_field: QC_INSP_REC (place<>detail) =====';
SELECT id, col_name, label, place, seq, visible, hidden, editable, data_type
  FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND place <> N'detail' ORDER BY place, seq, id;
PRINT N'===== yj_field: QC_INSP_REC_DETAIL 面板存不存在 =====';
SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL' GROUP BY panel_code;
PRINT N'===== qc_insp_rec_detail 物理列 =====';
SELECT c.name, t.name AS type, c.max_length
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_rec_detail') ORDER BY c.column_id;
PRINT N'===== qc_insp_rec_head 物理列 =====';
SELECT c.name, t.name AS type, c.max_length
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_rec_head') ORDER BY c.column_id;
PRINT N'===== yj_panel: QC_INSP_REC =====';
SELECT panel_code, panel_name, head_table, line_table, config FROM yj_panel WHERE panel_code LIKE N'QC_INSP_REC%';
PRINT N'===== 行数 =====';
SELECT COUNT(*) AS detail_rows, SUM(CASE WHEN ISNULL([结果1],N'')<>N'' OR ISNULL([结果2],N'')<>N'' OR ISNULL([结果3],N'')<>N'' OR ISNULL([结果4],N'')<>N'' OR ISNULL([结果5],N'')<>N'' THEN 1 ELSE 0 END) AS rows_with_result
  FROM dbo.qc_insp_rec_detail WHERE ISNULL(asp_cancel,'N') <> 'Y';
