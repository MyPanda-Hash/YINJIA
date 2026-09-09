-- migrate-wo-schedule.sql — 排产视图(计划层 #7):排单计划 + 齐套表 两个报表面板
-- 依据: 排单计划表格.xlsx 真实字段/公式 + 总流程整理 §3 #7
-- 公式对齐: 交期紧迫度 = 交期 - 今天; 完成数 = 工单报工(wo_progress)求和; 未完成 = 计划 - 完成
SET NOCOUNT ON;

IF OBJECT_ID('v_wo_schedule') IS NULL EXEC('CREATE VIEW v_wo_schedule AS
SELECT w.[单据编号] AS 工单号, w.[单据日期] AS 单据日期, w.[销售订单号] AS 销售订单号, w.[客户] AS 客户,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[规格型号] AS 规格型号,
       w.[订单数量] AS 订单数量, w.[成型计划数量] AS 成型计划数量,
       w.[交期] AS 交期,
       CASE WHEN TRY_CAST(w.[交期] AS date) IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), TRY_CAST(w.[交期] AS date)) END AS 交期紧迫度,
       w.[生产车间] AS 生产车间, w.[工单状态] AS 工单状态,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''混料''), 0) AS 混料完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''成型''), 0) AS 成型完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''切炭''), 0) AS 切炭完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''组装''), 0) AS 组装完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 装箱完成,
       w.[订单数量] - ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 未完成数量
FROM wo_order w
WHERE ISNULL(w.asp_cancel, ''N'') <> ''Y'';');
GO
IF OBJECT_ID('v_wo_kit') IS NULL EXEC('CREATE VIEW v_wo_kit AS
SELECT w.[单据编号] AS 工单号, w.[工单状态] AS 工单状态, w.[交期] AS 交期,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[订单数量] AS 订单数量,
       b.[子件编码] AS 子件编码, b.[子件名称] AS 子件名称, b.[规格型号] AS 子件规格,
       b.[定额数量] AS 单件用量, b.[定额数量] * w.[订单数量] AS 需求数量,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) AS 库存结余,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) - b.[定额数量] * w.[订单数量] AS 齐套缺口
FROM wo_order w
JOIN bs_bom b ON b.[父件编码] = w.[产品编码] AND ISNULL(b.[默认BOM], 0) = 1 AND ISNULL(b.[状态], N''启用'') = N''启用''
WHERE ISNULL(w.asp_cancel, ''N'') <> ''Y'';');
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_SCHEDULE') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_SCHEDULE', N'排单计划', N'报表', 'flat', 'v_wo_schedule', NULL, NULL, N'id', NULL, NULL, NULL, 50, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_KIT') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_KIT', N'工单齐套表', N'报表', 'flat', 'v_wo_kit', NULL, NULL, N'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
GO

-- 排单计划字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'工单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'工单号', N'工单号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'销售订单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'销售订单号', N'销售订单号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'客户') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'客户', N'客户', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'产品编码', N'产品编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'订单数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'订单数量', N'订单数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'成型计划数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'成型计划数量', N'成型计划数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'交期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'交期', N'交期', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'交期紧迫度') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'交期紧迫度', N'交期紧迫度(天)', N'整数', NULL, NULL, NULL, NULL, N'query,detail', 100, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'生产车间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'生产车间', N'生产车间', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 110, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'工单状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'工单状态', N'工单状态', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 120, 80, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'混料完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'混料完成', N'混料完成', N'小数', NULL, NULL, NULL, NULL, N'detail', 130, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'成型完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'成型完成', N'成型完成', N'小数', NULL, NULL, NULL, NULL, N'detail', 140, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'切炭完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'切炭完成', N'切炭完成', N'小数', NULL, NULL, NULL, NULL, N'detail', 150, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'组装完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'组装完成', N'组装完成', N'小数', NULL, NULL, NULL, NULL, N'detail', 160, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'装箱完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'装箱完成', N'装箱完成', N'小数', NULL, NULL, NULL, NULL, N'detail', 170, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_SCHEDULE' AND col_name=N'未完成数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_SCHEDULE', N'未完成数量', N'未完成数量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 180, 95, 0, 0, 0, 1);
-- 齐套表字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'工单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'工单号', N'工单号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'产品编码', N'产品编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'订单数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'订单数量', N'订单数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 40, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'子件编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'子件编码', N'子件编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'子件名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'子件名称', N'子件名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'子件规格') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'子件规格', N'子件规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'单件用量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'单件用量', N'单件用量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'需求数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'需求数量', N'需求数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 95, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'库存结余') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'库存结余', N'库存结余', N'小数', NULL, NULL, NULL, NULL, N'detail', 100, 95, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'齐套缺口') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'齐套缺口', N'齐套缺口', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 110, 95, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'交期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'交期', N'交期', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_KIT' AND col_name=N'工单状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_KIT', N'工单状态', N'工单状态', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 130, 80, 0, 0, 0, 1);
GO

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'排单计划' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'排单计划', 'en', N'Production Schedule', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工单齐套表' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'工单齐套表', 'en', N'WO Material Kit Check', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'工单号', 'en', N'WO No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交期紧迫度(天)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交期紧迫度(天)', 'en', N'Urgency (days)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未完成数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未完成数量', 'en', N'Open Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'子件编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'子件编码', 'en', N'Component Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'子件名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'子件名称', 'en', N'Component Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'子件规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'子件规格', 'en', N'Component Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单件用量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单件用量', 'en', N'Per-unit Usage', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'需求数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'需求数量', 'en', N'Required Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存结余' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存结余', 'en', N'On-hand Balance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'齐套缺口' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'齐套缺口', 'en', N'Kit Shortage', 'manual');
GO

PRINT N'migrate-wo-schedule 完成';
GO
