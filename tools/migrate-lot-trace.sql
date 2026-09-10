-- migrate-lot-trace.sql — 批号全链追溯视图(品质层 #11 收官):一批一号串起 收货→检验→入库→领料→质检→处置→成品→出库
SET NOCOUNT ON;
IF OBJECT_ID('v_lot_trace') IS NOT NULL DROP VIEW v_lot_trace;
GO
EXEC('CREATE VIEW v_lot_trace AS
-- 暂收(品检分流入口)
SELECT d.[批号] AS 批号, d.[物料编码] AS 物料编码, d.[物料名称] AS 物料名称, N''暂收'' AS 事件,
       h.[单据编号] AS 单据编号, h.[单据日期] AS 单据日期, d.[暂收数量] AS 数量, d.[仓库] AS 仓库,
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 状态,
       h.[经手人] AS 相关人, h.[供应商] AS 对象
FROM qc_recv_detail d JOIN qc_recv h ON h.[单据编号] = d.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_RECV'' AND st.doc_no = h.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
-- 来料检验(合格/不合格判定)
SELECT d.[批号], d.[物料编码], d.[物料名称], N''来料检验'', h.[单据编号], h.[单据日期], d.[送检数量], NULL,
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[检验员], h.[供应商]
FROM qc_insp_detail d JOIN qc_insp h ON h.[单据编号] = d.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_INSP'' AND st.doc_no = h.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
-- 采购入库(材料入仓)
SELECT l.[批号], l.[存货编码], l.[存货名称], N''采购入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[审核人], h.[供应商]
FROM bl_purchase_in l JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''PURCHASE_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
-- 领料出库(材料发往产线)
SELECT l.[批号], l.[材料编码], l.[材料名称], N''领料出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[领用人], h.[加工单号]
FROM bl_material_out l JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''MATERIAL_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
-- 工序质检(按工单)
SELECT NULL AS 批号, w.[产品编码], w.[产品名称], N''工序质检('' + h.[工序] + N'')'', h.[单据编号], h.[单据日期], NULL, w.[生产车间],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[检验员], h.[工单号]
FROM qc_op h JOIN wo_order w ON w.[单据编号] = h.[工单号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_OP'' AND st.doc_no = h.[单据编号]
WHERE ISNULL(h.asp_cancel,''N'')<>''Y''
UNION ALL
-- 不良品处置(隔离/报废)
SELECT d.[批号], d.[物料编码], d.[物料名称], N''不良处置('' + d.[处置方式] + N'')'', d.[单据编号], d.[单据日期], d.[数量], d.[原仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       d.[经手人], d.[处置原因]
FROM qc_disposal d LEFT JOIN yj_doc_status st ON st.panel_code = ''QC_DISPOSAL'' AND st.doc_no = d.[单据编号]
WHERE d.[批号] IS NOT NULL AND ISNULL(d.asp_cancel,''N'')<>''Y''
UNION ALL
-- 产成品入库(装箱后成品)
SELECT l.[批号], l.[产品编码], l.[产品名称], N''成品入库'', h.[单据编号], h.[单据日期], l.[实收数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[加工单号]
FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''FINISH_IN'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y''
UNION ALL
-- 销售出库(发往客户)
SELECT l.[批号], l.[存货编码], l.[存货名称], N''销售出库'', h.[单据编号], h.[单据日期], l.[数量], l.[仓库],
       CASE WHEN ISNULL(st.canceled,''N'')=''Y'' THEN N''已作废'' WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END,
       h.[经手人], h.[客户]
FROM bl_sale_out l JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status st ON st.panel_code = ''SALE_OUT'' AND st.doc_no = h.[单据编号]
WHERE l.[批号] IS NOT NULL AND ISNULL(l.asp_cancel,''N'')<>''Y'';');
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'LOT_TRACE') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('LOT_TRACE', N'批号追溯', N'报表', 'flat', 'v_lot_trace', NULL, NULL, N'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'事件') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'事件', N'事件', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'单据日期', N'单据日期', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'仓库') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'状态', N'状态', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 80, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'相关人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'相关人', N'相关人', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='LOT_TRACE' AND col_name=N'对象') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('LOT_TRACE', N'对象', N'对象', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 160, 0, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'批号追溯' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'批号追溯', 'en', N'Lot Traceability', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'事件' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'事件', 'en', N'Event', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'相关人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'相关人', 'en', N'Person', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'对象' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'对象', 'en', N'Related Party', 'manual');
GO
PRINT N'migrate-lot-trace 完成';
GO
