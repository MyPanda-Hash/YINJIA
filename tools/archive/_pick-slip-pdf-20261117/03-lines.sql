SET NOCOUNT ON;
SELECT d.id AS doc_id, d.领料类型, d.领料单号, d.状态, d.物料项数, d.已领项数, d.产品编号, d.产品名称,
       x.行号, x.物料编码, x.物料名称, x.规格型号, x.计量单位, x.需求数量, x.实领数量, x.批号, x.仓库
FROM dbo.wo_pick_doc d
LEFT JOIN dbo.wo_pick_line x ON x.单头id = d.id
WHERE d.工单号 = N'GD-2026-11-0009' AND d.工单行号 = 1
ORDER BY d.领料类型 DESC, TRY_CAST(x.行号 AS int), x.行号;
