-- migrate-wo-order.sql — 生产工单(计划层 #6):五道工序共用一张工单
-- 依据: 总流程整理 §3 #6-#8 + CONTEXT「生产过程」(一个整体,共用工单,混料阶段可多次打印)
-- 模型: wo_order 工单头(单产品) + wo_progress 工序进度行(五道工序预填,计划/完成数量)
-- 生成: 销售订单 →(选单)→ 生产工单;完成数量由生产过程层报工累计
SET NOCOUNT ON;

IF OBJECT_ID('wo_order') IS NULL CREATE TABLE wo_order (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [销售订单号] nvarchar(60) NULL,
  [客户] nvarchar(200) NULL,
  [产品编码] nvarchar(100) NULL,
  [产品名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [单位] nvarchar(50) NULL,
  [订单数量] decimal(18,4) NULL,
  [成型计划数量] decimal(18,4) NULL,
  [交期] nvarchar(20) NULL,
  [生产车间] nvarchar(100) NULL,
  [工单状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('wo_progress') IS NULL CREATE TABLE wo_progress (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [工序] nvarchar(50) NULL,
  [计划数量] decimal(18,4) NULL,
  [完成数量] decimal(18,4) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_ORDER') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_ORDER', N'生产工单', N'生产管理', 'doc', 'wo_progress', 'wo_order', N'单据编号', N'id', N'单据编号', N'GD', N'单据日期', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_PROGRESS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_PROGRESS', N'工单工序进度', N'生产管理', 'flat', 'wo_progress', NULL, NULL, N'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
GO

-- 字段(头)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'销售订单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'销售订单号', N'销售订单号', N'参照', NULL, N'SO_ORDER', N'单据编号', N'单据编号', N'query,header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'客户') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'客户', N'客户', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'产品编码', N'产品编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 50, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'query,header', 60, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'单位') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'单位', N'单位', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'订单数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'订单数量', N'订单数量', N'小数', NULL, NULL, NULL, NULL, N'query,header', 90, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'成型计划数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'成型计划数量', N'成型计划数量', N'小数', NULL, NULL, NULL, NULL, N'header', 100, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'交期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'交期', N'交期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 110, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'生产车间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'生产车间', N'生产车间', N'参照', NULL, N'WC', N'工作中心名称', N'工作中心名称', N'header', 120, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'工单状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'工单状态', N'工单状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 130, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 220, 1, 0, 0, 1);
-- 字段(工序进度行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'工序') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'工序', N'工序', N'下拉框', N'SELECT 工序名称 FROM bs_op WHERE ISNULL([状态],N''启用'')=N''启用'' AND ISNULL(是否停用,0)=0 ORDER BY id', NULL, NULL, NULL, N'detail', 200, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'计划数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'计划数量', N'计划数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 210, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_ORDER' AND col_name=N'完成数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_ORDER', N'完成数量', N'完成数量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 220, 100, 1, 0, 0, 1);
-- 平表面板字段(工单工序进度)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PROGRESS' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_PROGRESS', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PROGRESS' AND col_name=N'工序') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_PROGRESS', N'工序', N'工序', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PROGRESS' AND col_name=N'计划数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_PROGRESS', N'计划数量', N'计划数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 30, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PROGRESS' AND col_name=N'完成数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_PROGRESS', N'完成数量', N'完成数量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 40, 100, 0, 0, 0, 1);
GO

-- en 译名
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'生产工单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'生产工单', 'en', N'Production Work Order', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工单工序进度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'工单工序进度', 'en', N'WO Operation Progress', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售订单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售订单号', 'en', N'Sales Order No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品编码', 'en', N'Product Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品名称', 'en', N'Product Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'订单数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'订单数量', 'en', N'Order Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成型计划数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成型计划数量', 'en', N'Molding Plan Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交期', 'en', N'Due Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产车间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产车间', 'en', N'Workshop', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工单状态' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'工单状态', 'en', N'WO Status', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'工序', 'en', N'Operation', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'计划数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'计划数量', 'en', N'Plan Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'完成数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'完成数量', 'en', N'Done Qty', 'manual');
GO

PRINT N'migrate-wo-order 完成';
GO
