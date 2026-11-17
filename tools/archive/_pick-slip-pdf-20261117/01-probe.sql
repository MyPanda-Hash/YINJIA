SET NOCOUNT ON;
SELECT id, 工单号, 工单行号, 领料单号, 领料类型, 状态, 物料项数, 已领项数, 退料单号
FROM dbo.wo_pick_doc
WHERE 工单号 = N'GD-2026-11-0009'
ORDER BY 工单行号, 领料类型;
GO
SELECT x.单头id, d.工单行号, d.领料类型, x.行号, x.物料编码, x.物料名称, x.规格型号, x.计量单位,
       x.需求数量, x.实领数量, x.批号, x.仓库
FROM dbo.wo_pick_line x
JOIN dbo.wo_pick_doc d ON d.id = x.单头id
WHERE d.工单号 = N'GD-2026-11-0009'
ORDER BY x.单头id, TRY_CAST(x.行号 AS int), x.行号;
