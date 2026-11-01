SET NOCOUNT ON;
PRINT '--- fields that look like attachment/image (data_type or col_name) ---';
SELECT TOP 60 panel_code, col_name, label, data_type, place, visible, seq
FROM yj_field
WHERE col_name LIKE N'%图%' OR label LIKE N'%图%' OR col_name LIKE N'%附件%' OR label LIKE N'%附件%'
   OR data_type IN (N'图片', N'附件')
ORDER BY panel_code, seq;
PRINT '--- panels whose config mentions attach/upload ---';
SELECT panel_code, panel_name FROM yj_panel WHERE config LIKE '%attach%' OR config LIKE '%upload%' OR config LIKE '%图片%';
