-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物)
-- 背景:远程库对报表视图做过库上直改(补布局列)未入迁移链,本地旧版缺输出列 → 面板 500(Invalid column)。
-- 修法:panda 系 EXEC 单行原文动刀——首个行内 FROM 前插 NULL AS 补列(保原转义态);id 缺口(v_lot_trace)另由专项脚本管。
SET NOCOUNT ON;
-- 前置:先重放 migrate-panda-parity/migrate-panda-replica/migrate-status-align(权威视图基线,内容哈希已登记不会自动重跑,新库从零跑链时自然按序执行)
EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库] AS [发料仓库], NULL AS [材料仓库], NULL AS [经手人编码], h.[经手人], h.[备注], h.asp_user1 AS [制单人],
  l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]');
GO
EXEC(N'CREATE OR ALTER VIEW v_lot_trace AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, t.* FROM (SELECT d.[批号] AS 批号, d.[物料编码] AS 物料编码, d.[物料名称] AS 物料名称, N''来料检验'' AS 事件,        h.[单据编号] AS 单据编号, h.[单据日期] AS 单据日期, d.[送检数量] AS 数量, NULL AS 仓库,        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 状态,        h.[检验员] AS 相关人, h.[供应商] AS 对象, CAST(NULL AS char(1)) AS asp_cancel FROM qc_insp_detail d JOIN qc_insp h ON h.[单据编号] = d.[单据编号] LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_INSP'' AND st.doc_no = h.[单据编号] WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y'' UNION ALL SELECT l.[批号], l.[存货编码], l.[存货名称], N''采购入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        h.[审核人], h.[供应商], CAST(NULL AS char(1)) FROM bl_purchase_in l JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号] LEFT JOIN yj_doc_status st ON st.panel_code = ''PURCHASE_IN'' AND st.doc_no = h.[单据编号] WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y'' UNION ALL SELECT l.[批号], l.[材料编码], l.[材料名称], N''领料出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        h.[领用人], h.[加工单号], CAST(NULL AS char(1)) FROM bl_material_out l JOIN bd_material_out h ON h.[单据编号] = l.[单据编号] LEFT JOIN yj_doc_status st ON st.panel_code = ''MATERIAL_OUT'' AND st.doc_no = h.[单据编号] WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y'' UNION ALL SELECT NULL, w.[产品编码], w.[产品名称], N''工序质检('' + h.[工序] + N'')'', h.[单据编号], h.[单据日期], NULL, w.[生产车间],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        h.[检验员], h.[工单号], CAST(NULL AS char(1)) FROM qc_op h JOIN wo_order w ON w.[单据编号] = h.[工单号] LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_OP'' AND st.doc_no = h.[单据编号] WHERE ISNULL(h.asp_cancel,''N'')<>''Y'' UNION ALL SELECT d.[批号], d.[物料编码], d.[物料名称], N''不良处置('' + d.[处置方式] + N'')'', d.[单据编号], d.[单据日期], d.[数量], d.[原仓库],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        d.[经手人], d.[处置原因], CAST(NULL AS char(1)) FROM qc_disposal d LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_DISPOSAL'' AND st.doc_no = d.[单据编号] WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y'' UNION ALL SELECT l.[批号], l.[产品编码], l.[产品名称], N''成品入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        h.[经手人], h.[加工单号], CAST(NULL AS char(1)) FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号] LEFT JOIN yj_doc_status st ON st.panel_code = ''FINISH_IN'' AND st.doc_no = h.[单据编号] WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y'' UNION ALL SELECT l.[批号], l.[存货编码], l.[存货名称], N''销售出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],        CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,        h.[经手人], h.[客户], CAST(NULL AS char(1)) FROM bl_sale_out l JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号] LEFT JOIN yj_doc_status st ON st.panel_code = ''SALE_OUT'' AND st.doc_no = h.[单据编号] WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y'') t');

EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel, h.[单据日期], h.[单据编号], h.[业务类型], h.[委外供应商], h.[委外加工单号], h.[仓库] AS [发料仓库], h.[部门], h.[经手人], h.[来源单据], h.[来源单号],
  l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [材料仓库], l.[行中止]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]');

GO
-- 补固化(2026-09-24 复查):委外两 STATS 加真列(产品编码/材料编码;当时临时执行漏固化,远程视图迁移重置后复发)
EXEC(N'CREATE OR ALTER VIEW v_outsource_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [入库单数], SUM(COALESCE(l.[实收数量],0)) AS [实收数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_in h LEFT JOIN bl_outsource_in l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[产品编码], l.[产品名称], l.[规格型号], l.[计量单位]');
GO
EXEC(N'CREATE OR ALTER VIEW v_outsource_issue_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.[单据日期], h.asp_cancel,
  h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位],
  COUNT(DISTINCT h.[单据编号]) AS [发料单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号]
GROUP BY h.[单据日期], h.asp_cancel, h.[委外供应商], h.[仓库], l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位]');
GO

PRINT N'migrate-align-views-20260924 完成(终态:lot_trace+id/委外三视图对齐面板字段)';
