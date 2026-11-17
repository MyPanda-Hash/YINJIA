SET NOCOUNT ON;
SELECT
  d.id AS id,
  d.工单号 AS 工单号,
  d.工单行号 AS 工单行号,
  d.产品编号 AS 产品编号,
  d.产品名称 AS 产品名称,
  d.领料类型 AS 领料类型,
  d.领料单号 AS 领料单号,
  d.状态 AS 状态,
  (SELECT x.物料编码 AS 物料编码, x.物料名称 AS 材料名称, x.规格型号 AS 规格,
          x.计量单位 AS 单位, x.需求数量 AS 请领数量, x.实领数量 AS 实发数量,
          ISNULL(x.批号, N'') AS 备注
     FROM dbo.wo_pick_line x
    WHERE x.单头id = d.id
    ORDER BY TRY_CAST(x.行号 AS int), x.行号
     FOR JSON PATH) AS 明细JSON
FROM dbo.wo_pick_doc d
WHERE d.工单号 = N'GD-2026-11-0009' AND d.工单行号 = 1
ORDER BY d.领料类型
FOR JSON PATH, INCLUDE_NULL_VALUES;
