-- q-02-inv-hidden-dist.sql — INV 面板 detail 字段 hidden 分布(判定 hidden=1 是常态还是异常)
SET NOCOUNT ON;
SELECT N'INV detail 字段 hidden 分布' AS k, hidden, visible, COUNT(*) AS 行数
FROM yj_field WHERE panel_code = 'INV' AND place LIKE '%detail%'
GROUP BY hidden, visible ORDER BY hidden, visible;
GO
SELECT N'来料检验 邻近字段' AS k, id, col_name, label, place, seq, editable, visible, hidden
FROM yj_field WHERE panel_code = 'INV' AND seq BETWEEN 40 AND 48 ORDER BY seq, id;
GO
SELECT N'商品类型 邻近字段' AS k, id, col_name, label, place, seq, editable, visible, hidden
FROM yj_field WHERE panel_code = 'INV' AND seq BETWEEN 898 AND 902 ORDER BY seq, id;
GO
