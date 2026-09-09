-- migrate-rd-lab-sheets.sql — 实验室使用记录表 4 面板(加标水配置/内部委托测试申请/设备使用登记/仪器使用记录)
-- 按《3.实验室使用记录表》4 个 Excel 一比一复刻;沿用文书面板模式:head/detail 双表 + 中文列
-- 幂等:表已建跳过;yj_field 每次重建;翻译 NOT EXISTS 防重
SET NOCOUNT ON;
GO

-- ═══════════════ 1. 加标水配置记录表 RD_SPIKE_WATER(3 种测试项目,明细列并集) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_spike_water_head') IS NULL CREATE TABLE rd_spike_water_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [测试项目] nvarchar(60) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_spike_water_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_spike_water_detail') IS NULL CREATE TABLE rd_spike_water_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [测试日期] nvarchar(50) NULL,
  [项目名称] nvarchar(100) NULL,
  [测试装置] nvarchar(100) NULL,
  [测试工位] nvarchar(50) NULL,
  [配水量] nvarchar(50) NULL,
  [配置用水] nvarchar(50) NULL,
  [硫酸镁] nvarchar(50) NULL,
  [二水氯化钙] nvarchar(50) NULL,
  [碳酸氢钠] nvarchar(50) NULL,
  [4%次氯酸钠] nvarchar(50) NULL,
  [盐酸或氢氧化钠] nvarchar(50) NULL,
  [可溶性铅] nvarchar(50) NULL,
  [不可溶性铅] nvarchar(50) NULL,
  [汞标准溶液] nvarchar(50) NULL,
  [氯化钠] nvarchar(50) NULL,
  [三氯甲烷储备液] nvarchar(50) NULL,
  [PH] nvarchar(50) NULL,
  [TDS] nvarchar(50) NULL,
  [水温] nvarchar(50) NULL,
  [浊度值] nvarchar(50) NULL,
  [负责人] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_spike_water_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_spike_water_detail', head_table=N'rd_spike_water_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'SW', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_SPIKE_WATER';
GO
DELETE FROM yj_field WHERE panel_code='RD_SPIKE_WATER';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPIKE_WATER' AND col_name=N'测试项目' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPIKE_WATER', N'测试项目', N'测试项目', N'下拉框', N'SELECT v FROM (VALUES (N''NSF 53-除铅（PH8.5）''),(N''NSF 53-除汞（PH8.5）''),(N''NSF 53-除VOC'')) AS t(v)', NULL, NULL, NULL, N'query', 10, 180, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPIKE_WATER', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_SPIKE_WATER', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_SPIKE_WATER', N'测试项目', N'测试项目', N'下拉框', N'SELECT v FROM (VALUES (N''NSF 53-除铅（PH8.5）''),(N''NSF 53-除汞（PH8.5）''),(N''NSF 53-除VOC'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 180, 1, 1, 0, 1),
('RD_SPIKE_WATER', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPIKE_WATER', N'测试日期', N'测试日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'项目名称', N'项目名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 110, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'测试装置', N'测试装置', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 100, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'测试工位', N'测试工位', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'配水量', N'配水量\n（L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 80, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'配置用水', N'配置用水', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'硫酸镁', N'硫酸镁', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'二水氯化钙', N'二水氯化钙', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 100, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'碳酸氢钠', N'碳酸氢钠', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'4%次氯酸钠', N'4%次氯酸钠', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'盐酸或氢氧化钠', N'盐酸或氢氧化钠', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'可溶性铅', N'可溶性铅', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'不可溶性铅', N'不可溶性铅', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 100, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'汞标准溶液', N'汞标准溶液 \n1000mg/L', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 110, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'氯化钠', N'氯化钠（g）', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'三氯甲烷储备液', N'三氯甲烷储备液\n（1000mg/L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 130, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'PH', N'PH\n8.5±0.25', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'TDS', N'TDS（mg/L）200-500mg/L', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 110, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'水温', N'水温（℃）\n20±2.5℃', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 90, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'浊度值', N'浊度值（NTU）\n＜1NTU', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 100, 1, 0, 0, 1),
('RD_SPIKE_WATER', N'负责人', N'负责人', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 70, 1, 0, 0, 1);
GO

-- ═══════════════ 2. 内部委托测试申请单 RD_DOM_TEST(开发性/品质委托 2 变体) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_dom_test_head') IS NULL CREATE TABLE rd_dom_test_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_domtest_docno DEFAULT N'YJ-RIR001',
  [申请单类型] nvarchar(20) NULL,
  [文件管理人] nvarchar(50) NULL,
  [密级] nvarchar(20) NULL,
  [文件使用范围] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_dom_test_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_dom_test_detail') IS NULL CREATE TABLE rd_dom_test_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [序号] nvarchar(20) NULL,
  [日期] nvarchar(50) NULL,
  [申请人] nvarchar(50) NULL,
  [背景/目的] nvarchar(500) NULL,
  [尺寸] nvarchar(100) NULL,
  [配方] nvarchar(200) NULL,
  [密度] nvarchar(50) NULL,
  [产品编号] nvarchar(50) NULL,
  [产品名称] nvarchar(100) NULL,
  [生产批次] nvarchar(50) NULL,
  [方法] nvarchar(1000) NULL,
  [标准] nvarchar(100) NULL,
  [目标] nvarchar(200) NULL,
  [组装方式] nvarchar(200) NULL,
  [样品处理] nvarchar(200) NULL,
  [紧急程度] nvarchar(20) NULL,
  [期望完成日期] nvarchar(50) NULL,
  [预计完成日期] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_dom_test_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_dom_test_detail', head_table=N'rd_dom_test_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'DT', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_DOM_TEST';
GO
DELETE FROM yj_field WHERE panel_code='RD_DOM_TEST';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_DOM_TEST' AND col_name=N'申请单类型' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_DOM_TEST', N'申请单类型', N'申请单类型', N'下拉框', N'SELECT v FROM (VALUES (N''开发性''),(N''品质委托'')) AS t(v)', NULL, NULL, NULL, N'query', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_DOM_TEST' AND col_name=N'文件管理人' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_DOM_TEST', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 120, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_DOM_TEST', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_DOM_TEST', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_DOM_TEST', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 120, 1, 1, 1, 1),
('RD_DOM_TEST', N'申请单类型', N'申请单类型', N'下拉框', N'SELECT v FROM (VALUES (N''开发性''),(N''品质委托'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 1, 0, 1),
('RD_DOM_TEST', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 60, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 70, 110, 1, 0, 0, 1),
('RD_DOM_TEST', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_DOM_TEST', N'序号', N'序号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 50, 1, 0, 0, 1),
('RD_DOM_TEST', N'日期', N'日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'申请人', N'申请人', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 70, 1, 0, 0, 1),
('RD_DOM_TEST', N'背景/目的', N'测试（检测）背景/目的', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 180, 1, 0, 0, 1),
('RD_DOM_TEST', N'尺寸', N'尺寸', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'配方', N'配方', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'密度', N'密度', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 60, 1, 0, 0, 1),
('RD_DOM_TEST', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'生产批次', N'生产批次', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 90, 1, 0, 0, 1),
('RD_DOM_TEST', N'方法', N'测试（检测）方法', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 240, 1, 0, 0, 1),
('RD_DOM_TEST', N'标准', N'测试（检测）标准', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 1, 0, 0, 1),
('RD_DOM_TEST', N'目标', N'测试（检测）目标', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 1, 0, 0, 1),
('RD_DOM_TEST', N'组装方式', N'组装方式', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 140, 1, 0, 0, 1),
('RD_DOM_TEST', N'样品处理', N'测完后样品样品处理', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 140, 1, 0, 0, 1),
('RD_DOM_TEST', N'紧急程度', N'紧急程度', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 80, 1, 0, 0, 1),
('RD_DOM_TEST', N'期望完成日期', N'期望完成日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'预计完成日期', N'预计完成日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 100, 1, 0, 0, 1),
('RD_DOM_TEST', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 3. 设备使用登记表 RD_EQUIP_USE(7 台加标测试系统) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_equip_use_head') IS NULL CREATE TABLE rd_equip_use_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [设备名称] nvarchar(60) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_equip_use_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_equip_use_detail') IS NULL CREATE TABLE rd_equip_use_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [使用日期] nvarchar(50) NULL,
  [测试项目] nvarchar(100) NULL,
  [测试标准] nvarchar(100) NULL,
  [使用工位] nvarchar(50) NULL,
  [设备状态] nvarchar(100) NULL,
  [使用人] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_equip_use_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_equip_use_detail', head_table=N'rd_equip_use_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'EU', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_EQUIP_USE';
GO
DELETE FROM yj_field WHERE panel_code='RD_EQUIP_USE';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_EQUIP_USE' AND col_name=N'设备名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_EQUIP_USE', N'设备名称', N'设备名称', N'下拉框', N'SELECT v FROM (VALUES (N''加标测试系统1#''),(N''加标测试系统2#''),(N''加标测试系统3#''),(N''加标测试系统4#''),(N''加标测试系统5#''),(N''加标测试系统6#''),(N''加标测试系统7#'')) AS t(v)', NULL, NULL, NULL, N'query', 10, 140, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_EQUIP_USE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_EQUIP_USE', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_EQUIP_USE', N'设备名称', N'设备名称', N'下拉框', N'SELECT v FROM (VALUES (N''加标测试系统1#''),(N''加标测试系统2#''),(N''加标测试系统3#''),(N''加标测试系统4#''),(N''加标测试系统5#''),(N''加标测试系统6#''),(N''加标测试系统7#'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 140, 1, 1, 0, 1),
('RD_EQUIP_USE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_EQUIP_USE', N'使用日期', N'使用日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 90, 1, 0, 0, 1),
('RD_EQUIP_USE', N'测试项目', N'测试项目', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 1, 0, 0, 1),
('RD_EQUIP_USE', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 110, 1, 0, 0, 1),
('RD_EQUIP_USE', N'使用工位', N'使用工位', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 90, 1, 0, 0, 1),
('RD_EQUIP_USE', N'设备状态', N'设备状态\n（检查管路、阀门、启动是否正常）', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 150, 1, 0, 0, 1),
('RD_EQUIP_USE', N'使用人', N'使用人', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 80, 1, 0, 0, 1),
('RD_EQUIP_USE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 4. 仪器使用记录表 RD_INSTR_USE ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_instr_use_head') IS NULL CREATE TABLE rd_instr_use_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [仪器名称/型号] nvarchar(100) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_instr_use_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_instr_use_detail') IS NULL CREATE TABLE rd_instr_use_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [使用日期] nvarchar(50) NULL,
  [起止时间] nvarchar(50) NULL,
  [仪器状态] nvarchar(20) NULL,
  [是否内校] nvarchar(20) NULL,
  [项目名称/内容] nvarchar(200) NULL,
  [用途] nvarchar(100) NULL,
  [样品数量] nvarchar(50) NULL,
  [使用人] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_instr_use_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_instr_use_detail', head_table=N'rd_instr_use_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'IU', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_INSTR_USE';
GO
DELETE FROM yj_field WHERE panel_code='RD_INSTR_USE';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_INSTR_USE' AND col_name=N'仪器名称/型号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_INSTR_USE', N'仪器名称/型号', N'仪器名称/型号', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 140, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_INSTR_USE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_INSTR_USE', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_INSTR_USE', N'仪器名称/型号', N'仪器名称/型号', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 140, 1, 1, 0, 1),
('RD_INSTR_USE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_INSTR_USE', N'使用日期', N'使用日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 90, 1, 0, 0, 1),
('RD_INSTR_USE', N'起止时间', N'起止时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 100, 1, 0, 0, 1),
('RD_INSTR_USE', N'仪器状态', N'仪器状态\n√/×', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'detail', 30, 80, 1, 0, 0, 1),
('RD_INSTR_USE', N'是否内校', N'是否内校\n√/-', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''-'')) AS t(v)', NULL, NULL, NULL, N'detail', 40, 80, 1, 0, 0, 1),
('RD_INSTR_USE', N'项目名称/内容', N'项目名称/内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 200, 1, 0, 0, 1),
('RD_INSTR_USE', N'用途', N'用途', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, 1),
('RD_INSTR_USE', N'样品数量', N'样品数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 80, 1, 0, 0, 1),
('RD_INSTR_USE', N'使用人', N'使用人', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 80, 1, 0, 0, 1),
('RD_INSTR_USE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 权限 ═══════════════
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spike_water_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spike_water_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_dom_test_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_dom_test_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_equip_use_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_equip_use_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_instr_use_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_instr_use_detail TO yinjia;
GO

-- ═══════════════ 字段标签译名(en;已有跳过) ═══════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试项目' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试项目', 'en', N'Test Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目名称', 'en', N'Project Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试装置' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试装置', 'en', N'Apparatus', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试工位' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试工位', 'en', N'Station', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配水量\n（L）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配水量\n（L）', 'en', N'Volume (L)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配置用水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配置用水', 'en', N'Water Used', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'硫酸镁' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'硫酸镁', 'en', N'MgSO4', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'二水氯化钙' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'二水氯化钙', 'en', N'CaCl2·2H2O', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'碳酸氢钠' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'碳酸氢钠', 'en', N'NaHCO3', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'4%次氯酸钠' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'4%次氯酸钠', 'en', N'4% NaOCl', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盐酸或氢氧化钠' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'盐酸或氢氧化钠', 'en', N'HCl / NaOH', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'可溶性铅' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'可溶性铅', 'en', N'Soluble Lead', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不可溶性铅' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不可溶性铅', 'en', N'Insoluble Lead', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'汞标准溶液 \n1000mg/L' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'汞标准溶液 \n1000mg/L', 'en', N'Hg Standard 1000mg/L', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'氯化钠（g）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'氯化钠（g）', 'en', N'NaCl (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'三氯甲烷储备液\n（1000mg/L）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'三氯甲烷储备液\n（1000mg/L）', 'en', N'Chloroform Stock 1000mg/L', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'TDS（mg/L）200-500mg/L' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'TDS（mg/L）200-500mg/L', 'en', N'TDS (mg/L) 200-500', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浊度值（NTU）\n＜1NTU' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浊度值（NTU）\n＜1NTU', 'en', N'Turbidity (NTU) <1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'负责人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'负责人', 'en', N'Owner', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'申请单类型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'申请单类型', 'en', N'Request Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'文件管理人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'文件管理人', 'en', N'Document Keeper', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'文件使用范围' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'文件使用范围', 'en', N'Usage Scope', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序号', 'en', N'No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'申请人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'申请人', 'en', N'Applicant', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）背景/目的' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）背景/目的', 'en', N'Background / Purpose', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'尺寸' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'尺寸', 'en', N'Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品编号', 'en', N'Product No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产批次' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产批次', 'en', N'Batch', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）方法' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）方法', 'en', N'Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）标准' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）标准', 'en', N'Standard', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试（检测）目标' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试（检测）目标', 'en', N'Target', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'组装方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'组装方式', 'en', N'Assembly', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测完后样品样品处理' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测完后样品样品处理', 'en', N'Sample Disposal', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'紧急程度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'紧急程度', 'en', N'Urgency', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'期望完成日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'期望完成日期', 'en', N'Expected Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预计完成日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'预计完成日期', 'en', N'Estimated Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'设备名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'设备名称', 'en', N'Equipment', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'使用日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'使用日期', 'en', N'Date of Use', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'使用工位' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'使用工位', 'en', N'Station', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'设备状态\n（检查管路、阀门、启动是否正常）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'设备状态\n（检查管路、阀门、启动是否正常）', 'en', N'Equipment Status (pipes/valves/startup)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'使用人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'使用人', 'en', N'User', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器名称/型号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器名称/型号', 'en', N'Instrument / Model', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'起止时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'起止时间', 'en', N'Time Range', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器状态\n√/×' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器状态\n√/×', 'en', N'Status √/×', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否内校\n√/-' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否内校\n√/-', 'en', N'Internal Cal. √/-', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目名称/内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目名称/内容', 'en', N'Project / Content', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'用途' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'用途', 'en', N'Purpose', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'样品数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'样品数量', 'en', N'Sample Qty', 'manual');
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('RD_SPIKE_WATER','RD_DOM_TEST','RD_EQUIP_USE','RD_INSTR_USE'));
PRINT N'实验室使用记录表 4 面板字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
