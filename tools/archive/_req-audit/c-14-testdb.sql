SET NOCOUNT ON;
-- 测试库对比:预设库位 / 特采 / 面板
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%库位%' OR COLUMN_NAME LIKE N'%预设%';
GO
SELECT panel_code, col_name, label FROM yj_field WHERE col_name LIKE N'%库位%' OR label LIKE N'%库位%' OR label LIKE N'%特采%';
GO
SELECT COUNT(*) AS 测试库面板数 FROM yj_panel;
GO
SELECT COUNT(*) AS 测试库QC_RECV数 FROM yj_panel WHERE panel_code='QC_RECV';
GO
