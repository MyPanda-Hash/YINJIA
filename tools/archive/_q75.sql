SET NOCOUNT ON;
-- EXTRA_LINES 里的行级字段名(这些应该在 detail,不在 header)
SELECT DISTINCT e.c AS 行级列名 FROM OPENJSON(N'{}') AS x
-- 用另一个方法:看 detail 里已有的列(这些是对的)
SELECT col_name FROM yj_field WHERE panel_code='PURCHASE_IN' AND place='detail' AND seq >= 970 ORDER BY seq;
