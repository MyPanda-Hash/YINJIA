SET NOCOUNT ON;
SELECT DB_NAME() AS db;
SELECT COUNT(*) AS panel_cnt FROM yj_panel;
SELECT panel_code, panel_name, category, mode, prefix FROM yj_panel WHERE panel_name LIKE N'%调拨%' OR panel_name LIKE N'%盘点%';
