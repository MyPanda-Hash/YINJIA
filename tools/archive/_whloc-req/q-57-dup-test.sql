SET NOCOUNT ON;
SELECT id, seq, label AS 标签, col_name AS 物理列, data_type AS 类型, place, visible, hidden, editable, width
FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'存储分区' ORDER BY id;
GO