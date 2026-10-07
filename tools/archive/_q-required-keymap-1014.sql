SET NOCOUNT ON;
SELECT N'--- 必填字段中 col_name <> label 的(键错位风险) ---' AS s;
SELECT panel_code, col_name, label, data_type, place, required, hidden
FROM yj_field WHERE required=1 AND col_name <> label ORDER BY panel_code, seq;

SELECT N'--- 表头必填(place 含 header, 未隐藏)按面板汇总 ---' AS s;
SELECT panel_code, COUNT(*) AS 必填数, STRING_AGG(label, N'、') AS 字段
FROM yj_field WHERE required=1 AND hidden=0 AND place LIKE '%header%'
GROUP BY panel_code ORDER BY panel_code;
