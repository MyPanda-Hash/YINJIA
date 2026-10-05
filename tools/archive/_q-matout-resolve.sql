SET NOCOUNT ON;
-- 转ERP 头解析所依赖的两条档案查找(与 KingdeePushService.archiveCode 同 SQL)
SELECT '生产车间→部门编码' AS 解析, N'烧结车间' AS 输入, 部门编码 AS 结果 FROM bs_dept WHERE 部门名称=N'烧结车间' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'生产车间→部门编码', N'精整车间', 部门编码 FROM bs_dept WHERE 部门名称=N'精整车间' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'领用人→员工编码', N'白兴发', 员工编码 FROM bs_emp WHERE 员工名称=N'白兴发' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'仓库→仓库编码', N'原料仓', 仓库编码 FROM bs_wh WHERE 仓库名称=N'原料仓' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT N'计量单位→UOM命中', N'支', 计量单位编码 FROM bs_uom WHERE 计量单位名称=N'支' AND ISNULL(asp_cancel,'N')<>'Y';
GO
