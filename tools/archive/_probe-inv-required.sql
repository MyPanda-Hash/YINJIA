SET NOCOUNT ON;
-- 商品面板当前必填字段清单
SELECT col_name, label, data_type, place, required, editable, hidden, visible, seq
FROM dbo.yj_field WHERE panel_code='INV' AND required=1 ORDER BY seq, id;
GO
SELECT COUNT(*) AS INV字段总数, SUM(CAST(required AS int)) AS 必填数,
       SUM(CASE WHEN required=1 AND place LIKE '%detail%' THEN 1 ELSE 0 END) AS 明细必填数
FROM dbo.yj_field WHERE panel_code='INV';
GO
