-- q-07-purin-seq.sql — 采购入库单明细/表头列的 place/seq 现状(四单回归闸 FAIL 取证)
SET NOCOUNT ON;
SELECT N'PURCHASE_IN detail 前 12 行' AS k, id, col_name, label, place, seq, editable, visible, hidden, alias
FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND place LIKE '%detail%' ORDER BY seq, id
OFFSET 0 ROWS FETCH NEXT 12 ROWS ONLY;
GO
SELECT N'PURCHASE_IN 仓位相关' AS k, id, col_name, label, place, seq, editable, visible, hidden, alias
FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name LIKE N'%仓位%' ORDER BY place, seq, id;
GO
SELECT N'PURCHASE_IN seq 尾数分布(detail)' AS k, seq % 10 AS 尾数, COUNT(*) AS 行数
FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND place LIKE '%detail%' GROUP BY seq % 10 ORDER BY 1;
GO
SELECT N'四单 seq 尾数分布(全部)' AS k, panel_code, seq % 10 AS 尾数, COUNT(*) AS 行数
FROM yj_field WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
GROUP BY panel_code, seq % 10 ORDER BY panel_code, 尾数;
GO
