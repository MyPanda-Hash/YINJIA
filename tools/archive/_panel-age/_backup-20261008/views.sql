-- views.sql — 8 个待删视图的原始定义(回退用:去掉 IF 守卫直接建)
USE HSDZ_MES;
GO

-- ---- v_other_in_detail ----
CREATE   VIEW v_other_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[入库类别], NULL AS [部门编码] /* 无数据源,布局列 */, NULL AS [部门] /* 无数据源,布局列 */, NULL AS [经手人编码] /* 无数据源,布局列 */, NULL AS [经手人] /* 无数据源,布局列 */, h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[计量单位2], l.[数量2]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='OTHER_IN' AND s.doc_no=h.[单据编号]
GO

-- ---- v_other_in_stats ----
CREATE   VIEW v_other_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], h.[仓库], NULL AS [存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], l.[计量单位2] AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[数量2],0)) AS [数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='OTHER_IN' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位], l.[计量单位2]
GO

-- ---- v_other_out_detail ----
CREATE   VIEW v_other_out_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, l.[仓库], h.[出库类别], NULL AS [部门编码] /* 无数据源,布局列 */, h.[部门], NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, NULL AS [出库调整] /* 无数据源,布局列 */, NULL AS [累计调拨入库量] /* 无数据源,布局列 */, NULL AS [合理损耗数量] /* 无数据源,布局列 */, NULL AS [入库单号] /* 无数据源,布局列 */
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='OTHER_OUT' AND s.doc_no=h.[单据编号]
GO

-- ---- v_other_out_stats ----
CREATE   VIEW v_other_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], l.[仓库], NULL AS [存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [出库调整], NULL AS [累计调拨入库量(主单位)], NULL AS [合理损耗数量(主单位)]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='OTHER_OUT' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, l.[仓库], l.[存货名称], l.[规格型号], l.[计量单位]
GO

-- ---- v_outsource_in_detail ----
CREATE   VIEW v_outsource_in_detail AS SELECT h.*, l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], l.[现存量], l.[行中止] FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
GO

-- ---- v_outsource_in_stats ----
CREATE   VIEW v_outsource_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位]
GO

-- ---- v_outsource_issue_detail ----
CREATE   VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel,
       h.[单据日期], h.[单据编号], h.[业务类型], h.[委外供应商], h.[委外加工单号],
       h.[仓库] AS [发料仓库], h.[仓库], h.[部门], h.[经手人], h.[备注],
       h.[单据状态], h.[审核人], h.[审核时间], h.[审批人], h.[审批时间],
       h.asp_user1, h.asp_time1, h.asp_user2, h.asp_time2,
       h.[来源单据], h.[来源单号],
       l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额],
       l.[仓库] AS [材料仓库], l.[行中止]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号];
GO

-- ---- v_outsource_issue_stats ----
CREATE   VIEW v_outsource_issue_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位]
GO

