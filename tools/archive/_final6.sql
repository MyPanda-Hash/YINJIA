EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库] AS [发料仓库], NULL AS [材料仓库], NULL AS [经手人编码], h.[经手人], h.[备注], h.asp_user1 AS [制单人], h.[委外供应商],
  l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]');
