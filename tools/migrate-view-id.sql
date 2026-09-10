-- migrate-view-id.sql — 视图补 id 列(通用列表查询 SELECT t.id AS __id)+ 点检明细补备注列
SET NOCOUNT ON;
IF OBJECT_ID('v_wo_schedule') IS NOT NULL DROP VIEW v_wo_schedule;
IF OBJECT_ID('v_wo_kit') IS NOT NULL DROP VIEW v_wo_kit;
IF OBJECT_ID('v_lot_trace') IS NOT NULL DROP VIEW v_lot_trace;
GO
EXEC('CREATE VIEW v_wo_schedule AS
SELECT w.id AS id, w.[单据编号] AS 工单号, w.[单据日期] AS 单据日期, w.[销售订单号] AS 销售订单号, w.[客户] AS 客户,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[规格型号] AS 规格型号,
       w.[订单数量] AS 订单数量, w.[成型计划数量] AS 成型计划数量,
       w.[交期] AS 交期,
       CASE WHEN TRY_CAST(w.[交期] AS date) IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), TRY_CAST(w.[交期] AS date)) END AS 交期紧迫度,
       w.[生产车间] AS 生产车间,
       CASE WHEN ISNULL(st.canceled, ''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped, ''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 工单状态,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''混料''), 0) AS 混料完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''成型''), 0) AS 成型完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''切炭''), 0) AS 切炭完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''组装''), 0) AS 组装完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 装箱完成,
       w.[订单数量] - ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 未完成数量,
       CAST(NULL AS char(1)) AS asp_cancel
FROM wo_order w
LEFT JOIN yj_doc_status st ON st.panel_code = ''WO_ORDER'' AND st.doc_no = w.[单据编号]
WHERE ISNULL(st.canceled, ''N'') <> ''Y'';');
GO
EXEC('CREATE VIEW v_wo_kit AS
SELECT ROW_NUMBER() OVER (ORDER BY w.[单据编号], b.[子件编码]) AS id,
       w.[单据编号] AS 工单号,
       CASE WHEN ISNULL(st.canceled, ''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped, ''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 工单状态,
       w.[交期] AS 交期,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[订单数量] AS 订单数量,
       b.[子件编码] AS 子件编码, b.[子件名称] AS 子件名称, b.[规格型号] AS 子件规格,
       b.[定额数量] AS 单件用量, b.[定额数量] * w.[订单数量] AS 需求数量,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) AS 库存结余,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) - b.[定额数量] * w.[订单数量] AS 齐套缺口,
       CAST(NULL AS char(1)) AS asp_cancel
FROM wo_order w
JOIN bs_bom b ON b.[父件编码] = w.[产品编码] AND ISNULL(b.[默认BOM], 0) = 1 AND ISNULL(b.[状态], N''启用'') = N''启用''
LEFT JOIN yj_doc_status st ON st.panel_code = ''WO_ORDER'' AND st.doc_no = w.[单据编号]
WHERE ISNULL(st.canceled, ''N'') <> ''Y'';');
GO
EXEC('CREATE VIEW v_lot_trace AS
SELECT ROW_NUMBER() OVER (ORDER BY x.单据编号, x.事件) AS id, x.*, CAST(NULL AS char(1)) AS asp_cancel FROM (
SELECT d.[批号] AS 批号, d.[物料编码] AS 物料编码, d.[物料名称] AS 物料名称, N''暂收'' AS 事件,
       h.[单据编号] AS 单据编号, h.[单据日期] AS 单据日期, d.[暂收数量] AS 数量, d.[仓库] AS 仓库,
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 状态,
       h.[经手人] AS 相关人, h.[供应商] AS 对象
FROM qc_recv_detail d JOIN qc_recv h ON h.[单据编号] = d.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_RECV'' AND st.doc_no = h.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT d.[批号], d.[物料编码], d.[物料名称], N''来料检验'', h.[单据编号], h.[单据日期], d.[送检数量], NULL,
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[检验员], h.[供应商]
FROM qc_insp_detail d JOIN qc_insp h ON h.[单据编号] = d.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_INSP'' AND st.doc_no = h.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[存货编码], l.[存货名称], N''采购入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[审核人], h.[供应商]
FROM bl_purchase_in l JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''PURCHASE_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[材料编码], l.[材料名称], N''领料出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[领用人], h.[加工单号]
FROM bl_material_out l JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''MATERIAL_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT NULL, w.[产品编码], w.[产品名称], N''工序质检('' + h.[工序] + N'')'', h.[单据编号], h.[单据日期], NULL, w.[生产车间],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[检验员], h.[工单号]
FROM qc_op h JOIN wo_order w ON w.[单据编号] = h.[工单号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_OP'' AND st.doc_no = h.[单据编号]
WHERE ISNULL(h.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT d.[批号], d.[物料编码], d.[物料名称], N''不良处置('' + d.[处置方式] + N'')'', d.[单据编号], d.[单据日期], d.[数量], d.[原仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       d.[经手人], d.[处置原因]
FROM qc_disposal d LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_DISPOSAL'' AND st.doc_no = d.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[产品编码], l.[产品名称], N''成品入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[加工单号]
FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''FINISH_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
SELECT l.[批号], l.[存货编码], l.[存货名称], N''销售出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[客户]
FROM bl_sale_out l JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''SALE_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
) x;');
GO
BEGIN TRY
  IF COL_LENGTH('equip_check_detail', '备注') IS NULL ALTER TABLE equip_check_detail ADD [备注] nvarchar(200) NULL;
END TRY
BEGIN CATCH
  PRINT 'equip_check_detail 加列跳过';
END CATCH
GO
PRINT N'migrate-view-id 完成';
GO
