EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel, h.[单据日期], h.[单据编号], h.[业务类型], h.[委外供应商], h.[委外加工单号], h.[仓库] AS [发料仓库], h.[部门], h.[经手人], h.[来源单据], h.[来源单号],
  l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [材料仓库], l.[行中止]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]');
