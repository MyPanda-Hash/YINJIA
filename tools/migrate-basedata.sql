-- migrate-basedata.sql — 基础数据层(开发顺序第1层):物料检验标志 + ERP导入通道 + 批号流水 + 银嘉种子
-- 依据: tools/_flow-v12/基础数据层表结构草案-v0.1.md(已定稿,四决策 2026-09-10)
-- 代码考古修正:INV/OP/WC/WH/BOM 面板已挂 bs_* 新表(yj_panel 现行种子),本脚本不重复建面板,
--             仅补列/补字段/建通道表/种子数据/新增 ERPLG 两个面板。
-- 幂等:全部 IF NOT EXISTS / COL_LENGTH 守卫,可重复执行。
SET NOCOUNT ON;
GO

-- ══ 1. bs_inv 补列:品检分流依据(流程图:根据物料编码中是否检验项,自动判段) ══
BEGIN TRY
  IF COL_LENGTH('bs_inv','是否检验') IS NULL ALTER TABLE bs_inv ADD [是否检验] bit NOT NULL CONSTRAINT df_inv_jy DEFAULT(1);
  IF COL_LENGTH('bs_inv','检验方式') IS NULL ALTER TABLE bs_inv ADD [检验方式] nvarchar(20) NULL;      -- 全检/抽检(字典 JYFS)
  IF COL_LENGTH('bs_inv','数据来源') IS NULL ALTER TABLE bs_inv ADD [数据来源] nvarchar(20) NOT NULL CONSTRAINT df_inv_ly DEFAULT(N'ERP导入');
  IF COL_LENGTH('bs_inv','ERP更新时间') IS NULL ALTER TABLE bs_inv ADD [ERP更新时间] datetime2 NULL;
END TRY
BEGIN CATCH
  PRINT 'bs_inv 加列跳过(无 DDL 权限,管理员执行)';
END CATCH
GO

-- INV 面板新字段(seq 接 停用120/备注130 之间)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否检验') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'是否检验', N'是否检验', N'是否', NULL, NULL, NULL, NULL, N'query,detail', 122, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'检验方式') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'检验方式', N'检验方式', N'下拉框', N'SELECT mc FROM dm_gx WHERE lb=''JYFS'' AND ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY dm', NULL, NULL, NULL, N'detail', 124, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'数据来源') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'数据来源', N'数据来源', N'下拉框', N'SELECT v FROM (VALUES (N''ERP导入''),(N''手工'')) AS t(v)', NULL, NULL, NULL, N'detail', 126, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'ERP更新时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('INV', N'ERP更新时间', N'ERP更新时间', N'日期', NULL, NULL, NULL, NULL, N'detail', 128, 140, 0, 0, 0, 1);
GO

-- ══ 2. ERP 导入通道(API 自动同步已拍板:通道表留审计/重放,写入器走 API) ══
IF OBJECT_ID('dbo.erp_imp_log','U') IS NULL CREATE TABLE dbo.[erp_imp_log] (
  [id] int IDENTITY(1,1) NOT NULL,
  [批次号] nvarchar(30) NOT NULL,
  [导入类型] nvarchar(20) NOT NULL,            -- 资料/BOM/采购单/销售订单(字典 IMPTYP)
  [文件名] nvarchar(260) NULL,                 -- API 模式记接口批次说明,可空
  [总行数] int NOT NULL CONSTRAINT df_eil_total DEFAULT(0),
  [成功数] int NOT NULL CONSTRAINT df_eil_ok DEFAULT(0),
  [失败数] int NOT NULL CONSTRAINT df_eil_fail DEFAULT(0),
  [跳过数] int NOT NULL CONSTRAINT df_eil_skip DEFAULT(0),
  [状态] nvarchar(10) NOT NULL CONSTRAINT df_eil_st DEFAULT(N'待确认'),  -- 待确认/已入库/已取消
  [操作人] nvarchar(50) NULL,
  [导入时间] datetime2 NOT NULL CONSTRAINT df_eil_time DEFAULT(sysdatetime()),
  [备注] nvarchar(500) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL DEFAULT('N'),
  CONSTRAINT pk_erp_imp_log PRIMARY KEY (id),
  CONSTRAINT uq_erp_imp_log_batch UNIQUE ([批次号])
);
GO
IF OBJECT_ID('dbo.erp_imp_row','U') IS NULL CREATE TABLE dbo.[erp_imp_row] (
  [id] int IDENTITY(1,1) NOT NULL,
  [批次id] int NOT NULL,
  [批次号] nvarchar(30) NOT NULL,              -- 冗余批次号,便于明细面板直查
  [行号] int NOT NULL,
  [源单号] nvarchar(50) NULL,
  [原始JSON] nvarchar(max) NOT NULL,
  [解析状态] nvarchar(10) NOT NULL CONSTRAINT df_eir_parse DEFAULT(N'待解析'),  -- 待解析/成功/失败
  [错误信息] nvarchar(500) NULL,
  [目标表] nvarchar(50) NULL,                  -- bs_inv/bs_bom/bd_pu_order/bd_so_order
  [目标键] nvarchar(100) NULL,
  [处理状态] nvarchar(10) NOT NULL CONSTRAINT df_eir_proc DEFAULT(N'待确认'),   -- 待确认/已写入/忽略
  CONSTRAINT pk_erp_imp_row PRIMARY KEY (id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_erp_imp_row_batch') CREATE INDEX ix_erp_imp_row_batch ON erp_imp_row([批次id]);
GO

-- ══ 3. 批号流水:批号=入库日期(yyyymmdd)+3位流水;二维码=物料编码+批号 ══
IF OBJECT_ID('dbo.yj_lot_seq','U') IS NULL CREATE TABLE dbo.[yj_lot_seq] (
  [日期] date NOT NULL,
  [当前流水] int NOT NULL CONSTRAINT df_lot_seq DEFAULT(0),
  CONSTRAINT pk_yj_lot_seq PRIMARY KEY ([日期])
);
GO

-- ══ 4. ERPLG 面板:ERP导入日志(archive) + 导入明细(flat) ══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='ERPLG') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en) VALUES ('ERPLG', N'ERP导入日志', N'基础设置', N'archive', N'erp_imp_log', NULL, NULL, N'id', N'批次号', NULL, N'导入时间', 50, N'items', NULL, NULL, N'基础档案', N'ERP Import Log');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='ERPLG_ROW') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en) VALUES ('ERPLG_ROW', N'ERP导入明细', N'基础设置', N'flat', N'erp_imp_row', NULL, NULL, N'id', N'批次号', NULL, NULL, 100, N'items', NULL, NULL, N'基础档案', N'ERP Import Rows');
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'批次号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'批次号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 190, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'导入类型') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'导入类型', N'导入类型', N'下拉框', N'SELECT mc FROM dm_gx WHERE lb=''IMPTYP'' AND ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY dm', NULL, NULL, NULL, N'query,detail', 20, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'文件名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'文件名', N'文件名', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'总行数') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'总行数', N'总行数', N'整数', NULL, NULL, NULL, NULL, N'detail', 40, 80, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'成功数') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'成功数', N'成功数', N'整数', NULL, NULL, NULL, NULL, N'detail', 50, 80, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'失败数') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'失败数', N'失败数', N'整数', NULL, NULL, NULL, NULL, N'detail', 60, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'跳过数') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'跳过数', N'跳过数', N'整数', NULL, NULL, NULL, NULL, N'detail', 70, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'状态', N'状态', N'下拉框', N'SELECT v FROM (VALUES (N''待确认''),(N''已入库''),(N''已取消'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 80, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'操作人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'操作人', N'操作人', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'导入时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'导入时间', N'导入时间', N'日期', NULL, NULL, NULL, NULL, N'query,detail', 100, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'批次号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'批次号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 190, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'行号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'行号', N'行号', N'整数', NULL, NULL, NULL, NULL, N'detail', 20, 70, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'源单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'源单号', N'源单号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'解析状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'解析状态', N'解析状态', N'下拉框', N'SELECT v FROM (VALUES (N''待解析''),(N''成功''),(N''失败'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 40, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'错误信息') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'错误信息', N'错误信息', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 260, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'目标表') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'目标表', N'目标表', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'目标键') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'目标键', N'目标键', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ERPLG_ROW' AND col_name=N'处理状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('ERPLG_ROW', N'处理状态', N'处理状态', N'下拉框', N'SELECT v FROM (VALUES (N''待确认''),(N''已写入''),(N''忽略'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 80, 90, 0, 0, 0, 1);
GO

-- ══ 5. en 译名(其它语言实时机翻兜底) ══
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'ERP导入日志' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'ERP导入日志', 'en', N'ERP Import Log', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'ERP导入明细' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'ERP导入明细', 'en', N'ERP Import Rows', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否检验' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否检验', 'en', N'Inspection Required', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验方式', 'en', N'Inspection Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'数据来源' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'数据来源', 'en', N'Data Source', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'ERP更新时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'ERP更新时间', 'en', N'ERP Updated At', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批次号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批次号', 'en', N'Batch No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'导入类型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'导入类型', 'en', N'Import Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总行数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总行数', 'en', N'Total Rows', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成功数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成功数', 'en', N'Succeeded', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'失败数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'失败数', 'en', N'Failed', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'跳过数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'跳过数', 'en', N'Skipped', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'导入时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'导入时间', 'en', N'Imported At', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'操作人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'操作人', 'en', N'Operator', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'源单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'源单号', 'en', N'Source Doc No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'解析状态' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'解析状态', 'en', N'Parse Status', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'错误信息' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'错误信息', 'en', N'Error Message', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'目标表' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'目标表', 'en', N'Target Table', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'目标键' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'目标键', 'en', N'Target Key', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处理状态' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处理状态', 'en', N'Process Status', 'manual');
GO

-- ══ 6. 字典(运行时字典沿 dm_gx,同 migrate-rd-lab 先例) ══
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='JYFS' AND dm='JYFS01') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'JYFS01', N'全检', 'JYFS', 'N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='JYFS' AND dm='JYFS02') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'JYFS02', N'抽检', 'JYFS', 'N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='IMPTYP' AND dm='IMPTYP01') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'IMPTYP01', N'资料', 'IMPTYP', 'N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='IMPTYP' AND dm='IMPTYP02') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'IMPTYP02', N'BOM', 'IMPTYP', 'N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='IMPTYP' AND dm='IMPTYP03') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'IMPTYP03', N'采购单', 'IMPTYP', 'N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='IMPTYP' AND dm='IMPTYP04') INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES (0, 'IMPTYP04', N'销售订单', 'IMPTYP', 'N');
GO

-- ══ 7. 银嘉种子:五道工序 / 真实车间(含产能字段) / 仓别体系 ══
-- 工序(按名称守卫;关键工序=成型/切炭)
IF NOT EXISTS (SELECT 1 FROM bs_op WHERE 工序名称=N'混料') INSERT INTO bs_op (工序编码, 工序名称, 默认车间, 关键工序, [状态]) VALUES (N'OP-HL', N'混料', N'自制物料车间', 0, N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_op WHERE 工序名称=N'成型') INSERT INTO bs_op (工序编码, 工序名称, 默认车间, 关键工序, [状态]) VALUES (N'OP-CX', N'成型', N'成型1号车间', 1, N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_op WHERE 工序名称=N'切炭') INSERT INTO bs_op (工序编码, 工序名称, 默认车间, 关键工序, [状态]) VALUES (N'OP-QT', N'切炭', N'切炭车间', 1, N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_op WHERE 工序名称=N'组装') INSERT INTO bs_op (工序编码, 工序名称, 默认车间, 关键工序, [状态]) VALUES (N'OP-ZZ', N'组装', N'组装车间', 0, N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_op WHERE 工序名称=N'装箱') INSERT INTO bs_op (工序编码, 工序名称, 默认车间, 关键工序, [状态]) VALUES (N'OP-ZX', N'装箱', N'装箱车间', 0, N'启用');
-- 车间/工作中心(产量/小时=排产产能数据基础,初值 NULL 待工艺科填实)
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'自制物料车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-ZZWL', N'自制物料车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'成型1号车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-CX1', N'成型1号车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'成型2号车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-CX2', N'成型2号车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'成型3号车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-CX3', N'成型3号车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'成型4号车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-CX4', N'成型4号车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'成型5号车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-CX5', N'成型5号车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'切炭车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-QT', N'切炭车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'组装车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-ZZ', N'组装车间', N'车间', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wc WHERE 工作中心名称=N'装箱车间') INSERT INTO bs_wc (工作中心编码, 工作中心名称, 所属分类, [状态]) VALUES (N'WC-ZX', N'装箱车间', N'车间', N'启用');
-- 仓库(按名称守卫;隔离仓/不良品仓=品质层数据处理入口)
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'材料仓') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-CL', N'材料仓', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'成品仓') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-CP', N'成品仓', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'隔离仓') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-GL', N'隔离仓', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'不良品仓') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-BLP', N'不良品仓', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'线边仓-自制物料') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-XB-ZZWL', N'线边仓-自制物料', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'线边仓-成型') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-XB-CX', N'线边仓-成型', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'线边仓-切炭') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-XB-QT', N'线边仓-切炭', N'启用');
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE 仓库名称=N'线边仓-组装') INSERT INTO bs_wh (仓库编码, 仓库名称, [状态]) VALUES (N'WH-XB-ZZ', N'线边仓-组装', N'启用');
GO

PRINT N'migrate-basedata 完成:bs_inv 补列/ERP通道/批号流水/ERPLG 面板/字典/种子';
GO
