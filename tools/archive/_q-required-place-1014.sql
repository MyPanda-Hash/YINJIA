SET NOCOUNT ON;
SELECT N'--- 必填且同时出现在 表头+明细 的字段(只在明细里填 → 表头仍空 ⇒ 报"表头未填写") ---' AS s;
SELECT panel_code, col_name, label, data_type, place, seq
FROM yj_field
WHERE required=1 AND hidden=0 AND place LIKE '%header%' AND place LIKE '%detail%'
ORDER BY panel_code, seq;

SELECT N'--- 明细必填(place 含 detail, 未隐藏)按面板汇总 ---' AS s;
SELECT panel_code, COUNT(*) AS 必填数, STRING_AGG(label, N'、') AS 字段
FROM yj_field WHERE required=1 AND hidden=0 AND place LIKE '%detail%'
GROUP BY panel_code ORDER BY panel_code;
