SET NOCOUNT ON;
SELECT N'--- 有「明细参照字段」的面板(mode / 参数字段 / 明细参照字段) ---' AS s;
SELECT p.panel_code, p.panel_name, p.mode, COUNT(*) AS 明细参照字段数,
       STRING_AGG(f.label, N'、') AS 明细参照字段
FROM yj_panel p JOIN yj_field f ON f.panel_code = p.panel_code
WHERE f.data_type = N'参照' AND f.hidden = 0 AND f.place LIKE '%detail%'
GROUP BY p.panel_code, p.panel_name, p.mode
ORDER BY p.mode, p.panel_code;
