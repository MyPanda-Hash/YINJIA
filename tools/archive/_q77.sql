SET NOCOUNT ON;
SELECT col_name, label FROM yj_field WHERE panel_code='SALE_OUT' AND place='header' AND seq >= 970 ORDER BY seq;
