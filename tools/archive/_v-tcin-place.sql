SET NOCOUNT ON;
PRINT '=== QC_TC_IN 字段 place 分布 ===';
SELECT place, COUNT(*) AS 个数 FROM yj_field WHERE panel_code='QC_TC_IN' GROUP BY place;
GO
PRINT '=== QC_TC_IN 逐行 ===';
SELECT seq, col_name, data_type, place, editable, visible FROM yj_field WHERE panel_code='QC_TC_IN' ORDER BY seq;
GO
PRINT '=== 对照 QC_TC ===';
SELECT seq, col_name, data_type, place, editable FROM yj_field WHERE panel_code='QC_TC' ORDER BY seq;
GO
