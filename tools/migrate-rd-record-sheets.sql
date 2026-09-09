-- migrate-rd-record-sheets.sql — 数据记录表其余 7 张(碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降、精度)
-- 按《04数据记录表.xlsx》一比一复刻;沿用 RD_FILTER_EFF 模式:head/detail 双表 + 中文列 + 文书式面板
-- 幂等:表已建跳过;yj_field 每次重建;翻译 NOT EXISTS 防重
SET NOCOUNT ON;
GO

-- ═══════════════ 1. 碱性 RD_ALKALINE ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_alkaline_head') IS NULL CREATE TABLE rd_alkaline_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_alk_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [测试时间] nvarchar(200) NULL,
  [炭棒尺寸] nvarchar(100) NULL,
  [本次实验目的] nvarchar(500) NULL,
  [测试仪器] nvarchar(300) NULL,
  [测试装置及工位] nvarchar(500) NULL,
  [测试方式] nvarchar(1000) NULL,
  [原水自来水] nvarchar(20) NULL,
  [原水超纯水] nvarchar(20) NULL,
  [原水RO纯水] nvarchar(20) NULL,
  [原水PH] nvarchar(20) NULL,
  [原水TDS] nvarchar(20) NULL,
  [水温] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_alkaline_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_alkaline_detail') IS NULL CREATE TABLE rd_alkaline_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [测试时间] nvarchar(100) NULL,
  [测试流速] nvarchar(50) NULL,
  [杯数] nvarchar(50) NULL,
  [水温] nvarchar(50) NULL,
  [RO水PH] nvarchar(50) NULL,
  [RO水TDS] nvarchar(50) NULL,
  [滤芯出水PH] nvarchar(50) NULL,
  [滤芯出水TDS] nvarchar(50) NULL,
  [PH提升值] nvarchar(50) NULL,
  [钠] nvarchar(50) NULL,
  [镁] nvarchar(50) NULL,
  [钾] nvarchar(50) NULL,
  [钙] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_alkaline_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_alkaline_detail', head_table=N'rd_alkaline_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'PH', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_ALKALINE';
GO
DELETE FROM yj_field WHERE panel_code='RD_ALKALINE';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ALKALINE' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ALKALINE', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ALKALINE' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ALKALINE', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ALKALINE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_ALKALINE', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_ALKALINE', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_ALKALINE', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_ALKALINE', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_ALKALINE', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_ALKALINE', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_ALKALINE', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_ALKALINE', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1),
('RD_ALKALINE', N'炭棒尺寸', N'炭棒尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 100, 1, 0, 0, 1),
('RD_ALKALINE', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_ALKALINE', N'测试仪器', N'测试仪器', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 200, 1, 0, 0, 1),
('RD_ALKALINE', N'测试装置及工位', N'测试装置及工位', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 200, 1, 0, 0, 1),
('RD_ALKALINE', N'测试方式', N'测试方式', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 200, 1, 0, 0, 1),
('RD_ALKALINE', N'原水自来水', N'原水自来水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 160, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'原水超纯水', N'原水超纯水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 170, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'原水RO纯水', N'原水RO纯水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 180, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'原水PH', N'原水PH', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'原水TDS', N'原水TDS', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'水温', N'水温', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ALKALINE', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 100, 1, 0, 0, 1),
('RD_ALKALINE', N'测试流速', N'测试流速（L/min）', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 100, 1, 0, 0, 1),
('RD_ALKALINE', N'杯数', N'杯数(接水量100ml)', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 110, 1, 0, 0, 1),
('RD_ALKALINE', N'水温', N'水温（℃）', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'RO水PH', N'RO水PH', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'RO水TDS', N'RO水TDS', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'滤芯出水PH', N'滤芯出水PH', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'滤芯出水TDS', N'滤芯出水TDS', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'PH提升值', N'PH提升值', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 90, 1, 0, 0, 1),
('RD_ALKALINE', N'钠', N'钠', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'镁', N'镁', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'钾', N'钾', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 80, 1, 0, 0, 1),
('RD_ALKALINE', N'钙', N'钙', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 80, 1, 0, 0, 1);
GO

-- ═══════════════ 2. 矿化 RD_MINERAL ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_mineral_head') IS NULL CREATE TABLE rd_mineral_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_min_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [产品规格] nvarchar(100) NULL,
  [本次试验目的] nvarchar(1000) NULL,
  [测试仪器] nvarchar(300) NULL,
  [测试装置] nvarchar(500) NULL,
  [测试标准] nvarchar(300) NULL,
  [测试方法] nvarchar(1000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mineral_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_mineral_detail') IS NULL CREATE TABLE rd_mineral_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [指标] nvarchar(20) NULL,
  [测试日期] nvarchar(50) NULL,
  [累计流量] nvarchar(50) NULL,
  [RO出水] nvarchar(50) NULL,
  [浸泡30min] nvarchar(50) NULL,
  [浸泡30min煮沸晾凉] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mineral_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_mineral_detail', head_table=N'rd_mineral_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'MI', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_MINERAL';
GO
DELETE FROM yj_field WHERE panel_code='RD_MINERAL';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MINERAL' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MINERAL', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MINERAL' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MINERAL', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_MINERAL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_MINERAL', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_MINERAL', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_MINERAL', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_MINERAL', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_MINERAL', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_MINERAL', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_MINERAL', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_MINERAL', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_MINERAL', N'产品规格', N'产品规格', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 120, 1, 0, 0, 1),
('RD_MINERAL', N'本次试验目的', N'本次试验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 200, 1, 0, 0, 1),
('RD_MINERAL', N'测试仪器', N'测试仪器', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_MINERAL', N'测试装置', N'测试装置', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 200, 1, 0, 0, 1),
('RD_MINERAL', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 160, 1, 0, 0, 1),
('RD_MINERAL', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 200, 1, 0, 0, 1),
('RD_MINERAL', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_MINERAL', N'指标', N'指标', N'下拉框', N'SELECT v FROM (VALUES (N''锶 mg/L''),(N''偏硅酸 mg/L''),(N''PH''),(N''TDS'')) AS t(v)', NULL, NULL, NULL, N'detail', 10, 100, 1, 0, 0, 1),
('RD_MINERAL', N'测试日期', N'测试日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 100, 1, 0, 0, 1),
('RD_MINERAL', N'累计流量', N'累计流量L', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 90, 1, 0, 0, 1),
('RD_MINERAL', N'RO出水', N'RO出水', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 90, 1, 0, 0, 1),
('RD_MINERAL', N'浸泡30min', N'浸泡30min', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 90, 1, 0, 0, 1),
('RD_MINERAL', N'浸泡30min煮沸晾凉', N'浸泡30min煮沸晾凉', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 3. 抑菌 RD_ANTIBACT ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_antibact_head') IS NULL CREATE TABLE rd_antibact_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_ab_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [测试标准] nvarchar(100) NULL,
  [测试时间] nvarchar(100) NULL,
  [本次实验目的] nvarchar(1000) NULL,
  [试验用水] nvarchar(100) NULL,
  [测试装置/设备] nvarchar(200) NULL,
  [冲水方式] nvarchar(200) NULL,
  [测试方法] nvarchar(1000) NULL,
  [数据结论] nvarchar(2000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_antibact_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_antibact_detail') IS NULL CREATE TABLE rd_antibact_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [测试日期] nvarchar(50) NULL,
  [样品信息] nvarchar(2000) NULL,
  [累计流量] nvarchar(50) NULL,
  [原液浓度] nvarchar(50) NULL,
  [活性氧化铝] nvarchar(50) NULL,
  [去除率] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_antibact_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_antibact_detail', head_table=N'rd_antibact_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'AB', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_ANTIBACT';
GO
DELETE FROM yj_field WHERE panel_code='RD_ANTIBACT';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ANTIBACT' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ANTIBACT', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ANTIBACT' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ANTIBACT', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ANTIBACT', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_ANTIBACT', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_ANTIBACT', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_ANTIBACT', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_ANTIBACT', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_ANTIBACT', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_ANTIBACT', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_ANTIBACT', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_ANTIBACT', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_ANTIBACT', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 120, 1, 0, 0, 1),
('RD_ANTIBACT', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 120, 1, 0, 0, 1),
('RD_ANTIBACT', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_ANTIBACT', N'试验用水', N'试验用水', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 100, 1, 0, 0, 1),
('RD_ANTIBACT', N'测试装置/设备', N'测试装置/设备', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 140, 1, 0, 0, 1),
('RD_ANTIBACT', N'冲水方式', N'冲水方式', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 160, 1, 0, 0, 1),
('RD_ANTIBACT', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 200, 1, 0, 0, 1),
('RD_ANTIBACT', N'数据结论', N'数据结论', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 220, 1, 0, 0, 1),
('RD_ANTIBACT', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ANTIBACT', N'测试日期', N'测试日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 100, 1, 0, 0, 1),
('RD_ANTIBACT', N'样品信息', N'样品信息', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 260, 1, 0, 0, 1),
('RD_ANTIBACT', N'累计流量', N'累计流量（L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 100, 1, 0, 0, 1),
('RD_ANTIBACT', N'原液浓度', N'原液浓度（cfu/ml）', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 1, 0, 0, 1),
('RD_ANTIBACT', N'活性氧化铝', N'活性氧化铝（cfu/ml）', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 1, 0, 0, 1),
('RD_ANTIBACT', N'去除率', N'去除率（%）', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, 1);
GO

-- ═══════════════ 4. 阻垢性能 RD_SCALE ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_scale_head') IS NULL CREATE TABLE rd_scale_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_sc_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [炭棒尺寸] nvarchar(100) NULL,
  [特殊配方1] nvarchar(100) NULL,
  [特殊配方2] nvarchar(100) NULL,
  [特殊配方3] nvarchar(100) NULL,
  [本次实验目的] nvarchar(500) NULL,
  [加标水配置] nvarchar(1000) NULL,
  [测试方法] nvarchar(2000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_scale_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_scale_detail') IS NULL CREATE TABLE rd_scale_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [测试日期] nvarchar(50) NULL,
  [累计流量] nvarchar(50) NULL,
  [水温] nvarchar(50) NULL,
  [加标水硬度H0] nvarchar(50) NULL,
  [加标水烧开后硬度H1] nvarchar(50) NULL,
  [出水硬度1] nvarchar(50) NULL,
  [出水硬度2] nvarchar(50) NULL,
  [出水硬度3] nvarchar(50) NULL,
  [阻垢率1] nvarchar(50) NULL,
  [阻垢率2] nvarchar(50) NULL,
  [阻垢率3] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_scale_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_scale_detail', head_table=N'rd_scale_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'SC', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_SCALE';
GO
DELETE FROM yj_field WHERE panel_code='RD_SCALE';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SCALE' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SCALE', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SCALE' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SCALE', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SCALE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_SCALE', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_SCALE', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_SCALE', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_SCALE', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_SCALE', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_SCALE', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_SCALE', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_SCALE', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_SCALE', N'炭棒尺寸', N'炭棒尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 100, 1, 0, 0, 1),
('RD_SCALE', N'特殊配方1', N'特殊配方1', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 120, 1, 0, 0, 1),
('RD_SCALE', N'特殊配方2', N'特殊配方2', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 120, 1, 0, 0, 1),
('RD_SCALE', N'特殊配方3', N'特殊配方3', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 120, 1, 0, 0, 1),
('RD_SCALE', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 200, 1, 0, 0, 1),
('RD_SCALE', N'加标水配置', N'加标水配置', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 200, 1, 0, 0, 1),
('RD_SCALE', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 220, 1, 0, 0, 1),
('RD_SCALE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SCALE', N'测试日期', N'测试日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 100, 1, 0, 0, 1),
('RD_SCALE', N'累计流量', N'累计流量（L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 100, 1, 0, 0, 1),
('RD_SCALE', N'水温', N'水温（℃）', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 90, 1, 0, 0, 1),
('RD_SCALE', N'加标水硬度H0', N'加标水硬度H0', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1),
('RD_SCALE', N'加标水烧开后硬度H1', N'加标水烧开后硬度H1', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 130, 1, 0, 0, 1),
('RD_SCALE', N'出水硬度1', N'出水硬度（0.8mm-8g(1:2)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 150, 1, 0, 0, 1),
('RD_SCALE', N'出水硬度2', N'出水硬度（0.8mm-8g(1.1:1)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 150, 1, 0, 0, 1),
('RD_SCALE', N'出水硬度3', N'出水硬度（1.2mm-12g(1.1:1)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 150, 1, 0, 0, 1),
('RD_SCALE', N'阻垢率1', N'阻垢率（0.8mm-8g(1:2)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 140, 1, 0, 0, 1),
('RD_SCALE', N'阻垢率2', N'阻垢率（0.8mm-8g(1.1:1)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 140, 1, 0, 0, 1),
('RD_SCALE', N'阻垢率3', N'阻垢率（1.2mm-12g(1.1:1)）', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 140, 1, 0, 0, 1);
GO

-- ═══════════════ 5. RO保护 RD_RO_PROTECT ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_ro_protect_head') IS NULL CREATE TABLE rd_ro_protect_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_ro_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试背景/目的] nvarchar(1000) NULL,
  [项目名称] nvarchar(200) NULL,
  [本次实验目的] nvarchar(1000) NULL,
  [试验用水] nvarchar(200) NULL,
  [测试装置/设备] nvarchar(1000) NULL,
  [测试方法] nvarchar(1000) NULL,
  [冲水方式] nvarchar(1000) NULL,
  [产品名/规格] nvarchar(200) NULL,
  [配方/工艺] nvarchar(500) NULL,
  [测试结论] nvarchar(2000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_ro_protect_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_ro_protect_detail') IS NULL CREATE TABLE rd_ro_protect_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [样品] nvarchar(100) NULL,
  [测试日期] nvarchar(50) NULL,
  [累计流量] nvarchar(50) NULL,
  [膜前压] nvarchar(50) NULL,
  [纯水流速] nvarchar(50) NULL,
  [废水流速] nvarchar(50) NULL,
  [衰减率] nvarchar(50) NULL,
  [原水tds] nvarchar(50) NULL,
  [纯水tds] nvarchar(50) NULL,
  [脱盐率] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_ro_protect_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_ro_protect_detail', head_table=N'rd_ro_protect_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'RO', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_RO_PROTECT';
GO
DELETE FROM yj_field WHERE panel_code='RD_RO_PROTECT';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_RO_PROTECT' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_RO_PROTECT', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_RO_PROTECT' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_RO_PROTECT', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_RO_PROTECT', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_RO_PROTECT', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_RO_PROTECT', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_RO_PROTECT', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_RO_PROTECT', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_RO_PROTECT', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_RO_PROTECT', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_RO_PROTECT', N'测试背景/目的', N'测试背景/目的', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_RO_PROTECT', N'项目名称', N'项目名称', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1),
('RD_RO_PROTECT', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 200, 1, 0, 0, 1),
('RD_RO_PROTECT', N'试验用水', N'试验用水', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 140, 1, 0, 0, 1),
('RD_RO_PROTECT', N'测试装置/设备', N'测试装置/设备', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 200, 1, 0, 0, 1),
('RD_RO_PROTECT', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 200, 1, 0, 0, 1),
('RD_RO_PROTECT', N'冲水方式', N'冲水方式', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 200, 1, 0, 0, 1),
('RD_RO_PROTECT', N'产品名/规格', N'产品名/规格', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 140, 1, 0, 0, 1),
('RD_RO_PROTECT', N'配方/工艺', N'配方/工艺', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 160, 1, 0, 0, 1),
('RD_RO_PROTECT', N'测试结论', N'测试结论', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 220, 1, 0, 0, 1),
('RD_RO_PROTECT', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_RO_PROTECT', N'样品', N'样品', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 90, 1, 0, 0, 1),
('RD_RO_PROTECT', N'测试日期', N'测试日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'累计流量', N'累计流量（L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'膜前压', N'膜前压（MPa）', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'纯水流速', N'纯水流速(mL/min)', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 1, 0, 0, 1),
('RD_RO_PROTECT', N'废水流速', N'废水流速(L/min)', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1),
('RD_RO_PROTECT', N'衰减率', N'衰减率', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1),
('RD_RO_PROTECT', N'原水tds', N'原水（tds）', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'纯水tds', N'纯水（tds）', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 100, 1, 0, 0, 1),
('RD_RO_PROTECT', N'脱盐率', N'脱盐率', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 90, 1, 0, 0, 1);
GO

-- ═══════════════ 6. 浸泡安全 RD_SOAK ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_soak_head') IS NULL CREATE TABLE rd_soak_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_sk_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [测试标准] nvarchar(300) NULL,
  [测试时间] nvarchar(100) NULL,
  [本次实验目的] nvarchar(1000) NULL,
  [浸泡水配置] nvarchar(1000) NULL,
  [测试方法] nvarchar(2000) NULL,
  [炭棒尺寸1] nvarchar(50) NULL,
  [炭棒尺寸2] nvarchar(50) NULL,
  [炭棒尺寸3] nvarchar(50) NULL,
  [浸泡液用量1] nvarchar(50) NULL,
  [浸泡液用量2] nvarchar(50) NULL,
  [浸泡液用量3] nvarchar(50) NULL,
  [仪器名称1] nvarchar(100) NULL,
  [品牌型号1] nvarchar(100) NULL,
  [检出限1] nvarchar(100) NULL,
  [仪器名称2] nvarchar(100) NULL,
  [品牌型号2] nvarchar(100) NULL,
  [检出限2] nvarchar(100) NULL,
  [仪器名称3] nvarchar(100) NULL,
  [品牌型号3] nvarchar(100) NULL,
  [检出限3] nvarchar(100) NULL,
  [仪器名称4] nvarchar(100) NULL,
  [品牌型号4] nvarchar(100) NULL,
  [检出限4] nvarchar(100) NULL,
  [实验结论] nvarchar(2000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_soak_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_soak_detail') IS NULL CREATE TABLE rd_soak_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [序号] nvarchar(20) NULL,
  [项目] nvarchar(50) NULL,
  [卫生要求] nvarchar(200) NULL,
  [增加改变值1] nvarchar(50) NULL,
  [增加改变值2] nvarchar(50) NULL,
  [增加改变值3] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_soak_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_soak_detail', head_table=N'rd_soak_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'SK', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_SOAK';
GO
DELETE FROM yj_field WHERE panel_code='RD_SOAK';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SOAK' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SOAK', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SOAK' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SOAK', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SOAK', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_SOAK', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_SOAK', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_SOAK', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_SOAK', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_SOAK', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_SOAK', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_SOAK', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_SOAK', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_SOAK', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 200, 1, 0, 0, 1),
('RD_SOAK', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 120, 1, 0, 0, 1),
('RD_SOAK', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_SOAK', N'浸泡水配置', N'浸泡水配置', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 200, 1, 0, 0, 1),
('RD_SOAK', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 220, 1, 0, 0, 1),
('RD_SOAK', N'炭棒尺寸1', N'炭棒尺寸（1）', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 110, 1, 0, 0, 1),
('RD_SOAK', N'炭棒尺寸2', N'炭棒尺寸（2）', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 110, 1, 0, 0, 1),
('RD_SOAK', N'炭棒尺寸3', N'炭棒尺寸（3）', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 110, 1, 0, 0, 1),
('RD_SOAK', N'浸泡液用量1', N'浸泡液用量（1）ml', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 110, 1, 0, 0, 1),
('RD_SOAK', N'浸泡液用量2', N'浸泡液用量（2）ml', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 110, 1, 0, 0, 1),
('RD_SOAK', N'浸泡液用量3', N'浸泡液用量（3）ml', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 110, 1, 0, 0, 1),
('RD_SOAK', N'仪器名称1', N'仪器名称（PH）', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 120, 1, 0, 0, 1),
('RD_SOAK', N'品牌型号1', N'品牌型号（PH）', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 120, 1, 0, 0, 1),
('RD_SOAK', N'检出限1', N'检出限（PH）', N'文本', NULL, NULL, NULL, NULL, N'header', 230, 90, 1, 0, 0, 1),
('RD_SOAK', N'仪器名称2', N'仪器名称（TDS）', N'文本', NULL, NULL, NULL, NULL, N'header', 240, 120, 1, 0, 0, 1),
('RD_SOAK', N'品牌型号2', N'品牌型号（TDS）', N'文本', NULL, NULL, NULL, NULL, N'header', 250, 120, 1, 0, 0, 1),
('RD_SOAK', N'检出限2', N'检出限（TDS）', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 90, 1, 0, 0, 1),
('RD_SOAK', N'仪器名称3', N'仪器名称（浊度）', N'文本', NULL, NULL, NULL, NULL, N'header', 270, 120, 1, 0, 0, 1),
('RD_SOAK', N'品牌型号3', N'品牌型号（浊度）', N'文本', NULL, NULL, NULL, NULL, N'header', 280, 120, 1, 0, 0, 1),
('RD_SOAK', N'检出限3', N'检出限（浊度）', N'文本', NULL, NULL, NULL, NULL, N'header', 290, 90, 1, 0, 0, 1),
('RD_SOAK', N'仪器名称4', N'仪器名称（重金属）', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 130, 1, 0, 0, 1),
('RD_SOAK', N'品牌型号4', N'品牌型号（重金属）', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 130, 1, 0, 0, 1),
('RD_SOAK', N'检出限4', N'检出限（重金属）', N'文本', NULL, NULL, NULL, NULL, N'header', 320, 110, 1, 0, 0, 1),
('RD_SOAK', N'实验结论', N'实验结论', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 220, 1, 0, 0, 1),
('RD_SOAK', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 340, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SOAK', N'序号', N'序号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 60, 1, 0, 0, 1),
('RD_SOAK', N'项目', N'项目', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 110, 1, 0, 0, 1),
('RD_SOAK', N'卫生要求', N'卫生要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 220, 1, 0, 0, 1),
('RD_SOAK', N'增加改变值1', N'需求2（30*10*113）增加/改变值', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 170, 1, 0, 0, 1),
('RD_SOAK', N'增加改变值2', N'需求2（35*13*107）增加/改变值', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 170, 1, 0, 0, 1),
('RD_SOAK', N'增加改变值3', N'需求4（40.5*10*114）增加/改变值', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 170, 1, 0, 0, 1);
GO

-- ═══════════════ 7. 压降、精度 RD_DROP_PREC ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_drop_prec_head') IS NULL CREATE TABLE rd_drop_prec_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_dp_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [报告编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [炭棒尺寸] nvarchar(100) NULL,
  [测试要求] nvarchar(500) NULL,
  [测试装置及编号] nvarchar(200) NULL,
  [测试方法] nvarchar(2000) NULL,
  [测试用仪器/检出限] nvarchar(200) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_drop_prec_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_drop_prec_detail') IS NULL CREATE TABLE rd_drop_prec_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [测试时间] nvarchar(50) NULL,
  [配方] nvarchar(500) NULL,
  [样品编号] nvarchar(50) NULL,
  [密度] nvarchar(50) NULL,
  [测试水温] nvarchar(50) NULL,
  [测试流速] nvarchar(50) NULL,
  [前压] nvarchar(50) NULL,
  [后压] nvarchar(50) NULL,
  [压差] nvarchar(50) NULL,
  [颗粒物去除率] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_drop_prec_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_drop_prec_detail', head_table=N'rd_drop_prec_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'DP', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_DROP_PREC';
GO
DELETE FROM yj_field WHERE panel_code='RD_DROP_PREC';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_DROP_PREC' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_DROP_PREC', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_DROP_PREC' AND col_name=N'报告编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_DROP_PREC', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_DROP_PREC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_DROP_PREC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_DROP_PREC', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_DROP_PREC', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_DROP_PREC', N'报告编号', N'报告编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_DROP_PREC', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_DROP_PREC', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_DROP_PREC', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_DROP_PREC', N'炭棒尺寸', N'炭棒尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 100, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试要求', N'测试要求', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 200, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试装置及编号', N'测试装置及编号', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 160, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 220, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试用仪器/检出限', N'测试用仪器/检出限', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 160, 1, 0, 0, 1),
('RD_DROP_PREC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_DROP_PREC', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 100, 1, 0, 0, 1),
('RD_DROP_PREC', N'配方', N'配方', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 240, 1, 0, 0, 1),
('RD_DROP_PREC', N'样品编号', N'样品编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 110, 1, 0, 0, 1),
('RD_DROP_PREC', N'密度', N'密度', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 80, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试水温', N'测试水温（℃）', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 100, 1, 0, 0, 1),
('RD_DROP_PREC', N'测试流速', N'测试流速（L/min）', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1),
('RD_DROP_PREC', N'前压', N'前压（kpa)', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1),
('RD_DROP_PREC', N'后压', N'后压（kpa)', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 90, 1, 0, 0, 1),
('RD_DROP_PREC', N'压差', N'压差（kpa)', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 90, 1, 0, 0, 1),
('RD_DROP_PREC', N'颗粒物去除率', N'0.5-1μm颗粒物去除率-2min（%）', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 170, 1, 0, 0, 1),
('RD_DROP_PREC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 权限 ═══════════════
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_alkaline_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_alkaline_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mineral_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mineral_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_antibact_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_antibact_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_scale_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_scale_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_ro_protect_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_ro_protect_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_soak_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_soak_detail TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_drop_prec_head TO yinjia;
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON rd_drop_prec_detail TO yinjia;
GO

-- ═══════════════ 面板名译名(en;其余语言由机翻兜底) ═══════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'碱性' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'碱性', 'en', N'Alkalinity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'矿化' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'矿化', 'en', N'Mineralization', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'抑菌' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'抑菌', 'en', N'Antibacterial', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'阻垢性能' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'阻垢性能', 'en', N'Scale Inhibition', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'RO保护' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'RO保护', 'en', N'RO Protection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'浸泡安全' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'浸泡安全', 'en', N'Soaking Safety', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'压降精度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'压降精度', 'en', N'Pressure Drop & Precision', 'manual');
GO

-- ═══════════════ 字段标签译名(en;已有标签跳过,全局共享) ═══════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报告编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报告编号', 'en', N'Report No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试主题' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试主题', 'en', N'Test Subject', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试目的/背景' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试目的/背景', 'en', N'Purpose / Background', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒尺寸' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒尺寸', 'en', N'Carbon Rod Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次实验目的' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次实验目的', 'en', N'Objective of This Test', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'本次试验目的' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'本次试验目的', 'en', N'Objective of This Test', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试仪器' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试仪器', 'en', N'Instruments', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试装置及工位' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试装置及工位', 'en', N'Apparatus & Station', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试方式', 'en', N'Test Method (General)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水自来水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水自来水', 'en', N'Raw: Tap Water', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水超纯水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水超纯水', 'en', N'Raw: Ultrapure Water', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水RO纯水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水RO纯水', 'en', N'Raw: RO Water', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水PH' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水PH', 'en', N'Raw pH', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水TDS' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水TDS', 'en', N'Raw TDS', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试流速（L/min）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试流速（L/min）', 'en', N'Flow (L/min)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'杯数(接水量100ml)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'杯数(接水量100ml)', 'en', N'Cup (100ml)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'钠' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'钠', 'en', N'Na', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'镁' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'镁', 'en', N'Mg', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'钾' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'钾', 'en', N'K', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'钙' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'钙', 'en', N'Ca', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品规格', 'en', N'Product Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试标准' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试标准', 'en', N'Test Standard', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'指标' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'指标', 'en', N'Metric', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'累计流量L' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'累计流量L', 'en', N'Cumulative Flow (L)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'RO出水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'RO出水', 'en', N'RO Output', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡30min' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡30min', 'en', N'Soak 30min', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡30min煮沸晾凉' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡30min煮沸晾凉', 'en', N'Soak 30min, Boiled & Cooled', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'试验用水' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'试验用水', 'en', N'Test Water', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试装置/设备' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试装置/设备', 'en', N'Apparatus / Equipment', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'冲水方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'冲水方式', 'en', N'Flushing Mode', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'样品信息' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'样品信息', 'en', N'Sample Info', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原液浓度（cfu/ml）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原液浓度（cfu/ml）', 'en', N'Feed Conc. (cfu/ml)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'活性氧化铝（cfu/ml）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'活性氧化铝（cfu/ml）', 'en', N'Alumina (cfu/ml)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'去除率（%）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'去除率（%）', 'en', N'Removal (%)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'数据结论' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'数据结论', 'en', N'Conclusion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特殊配方1' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特殊配方1', 'en', N'Formula 1#', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特殊配方2' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特殊配方2', 'en', N'Formula 2#', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特殊配方3' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特殊配方3', 'en', N'Formula 3#', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加标水配置' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'加标水配置', 'en', N'Spike Water Prep', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加标水硬度H0' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'加标水硬度H0', 'en', N'Spike Hardness H0', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加标水烧开后硬度H1' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'加标水烧开后硬度H1', 'en', N'Spike Boiled Hardness H1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'出水硬度（0.8mm-8g(1:2)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'出水硬度（0.8mm-8g(1:2)）', 'en', N'Output Hardness (0.8mm-8g 1:2)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'出水硬度（0.8mm-8g(1.1:1)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'出水硬度（0.8mm-8g(1.1:1)）', 'en', N'Output Hardness (0.8mm-8g 1.1:1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'出水硬度（1.2mm-12g(1.1:1)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'出水硬度（1.2mm-12g(1.1:1)）', 'en', N'Output Hardness (1.2mm-12g 1.1:1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'阻垢率（0.8mm-8g(1:2)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'阻垢率（0.8mm-8g(1:2)）', 'en', N'Scale Inhibition (0.8mm-8g 1:2)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'阻垢率（0.8mm-8g(1.1:1)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'阻垢率（0.8mm-8g(1.1:1)）', 'en', N'Scale Inhibition (0.8mm-8g 1.1:1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'阻垢率（1.2mm-12g(1.1:1)）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'阻垢率（1.2mm-12g(1.1:1)）', 'en', N'Scale Inhibition (1.2mm-12g 1.1:1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试背景/目的' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试背景/目的', 'en', N'Background / Purpose', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目名称', 'en', N'Project Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品名/规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品名/规格', 'en', N'Product / Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配方/工艺' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配方/工艺', 'en', N'Formula / Process', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试结论' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试结论', 'en', N'Conclusion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'纯水流速(mL/min)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'纯水流速(mL/min)', 'en', N'Permeate Flow (mL/min)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'废水流速(L/min)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'废水流速(L/min)', 'en', N'Reject Flow (L/min)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'衰减率' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'衰减率', 'en', N'Decay Rate', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原水（tds）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原水（tds）', 'en', N'Feed (tds)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'纯水（tds）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'纯水（tds）', 'en', N'Permeate (tds)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'脱盐率' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'脱盐率', 'en', N'Salt Rejection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡水配置' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡水配置', 'en', N'Soak Water Prep', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒尺寸（1）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒尺寸（1）', 'en', N'Rod Size (1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒尺寸（2）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒尺寸（2）', 'en', N'Rod Size (2)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒尺寸（3）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒尺寸（3）', 'en', N'Rod Size (3)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡液用量（1）ml' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡液用量（1）ml', 'en', N'Soak Volume (1) ml', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡液用量（2）ml' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡液用量（2）ml', 'en', N'Soak Volume (2) ml', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'浸泡液用量（3）ml' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'浸泡液用量（3）ml', 'en', N'Soak Volume (3) ml', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器名称（PH）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器名称（PH）', 'en', N'Instrument (pH)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌型号（PH）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌型号（PH）', 'en', N'Model (pH)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检出限（PH）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检出限（PH）', 'en', N'Detection Limit (pH)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器名称（TDS）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器名称（TDS）', 'en', N'Instrument (TDS)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌型号（TDS）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌型号（TDS）', 'en', N'Model (TDS)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检出限（TDS）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检出限（TDS）', 'en', N'Detection Limit (TDS)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器名称（浊度）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器名称（浊度）', 'en', N'Instrument (Turbidity)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌型号（浊度）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌型号（浊度）', 'en', N'Model (Turbidity)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检出限（浊度）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检出限（浊度）', 'en', N'Detection Limit (Turbidity)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仪器名称（重金属）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仪器名称（重金属）', 'en', N'Instrument (Heavy Metal)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品牌型号（重金属）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品牌型号（重金属）', 'en', N'Model (Heavy Metal)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检出限（重金属）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检出限（重金属）', 'en', N'Detection Limit (Heavy Metal)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实验结论' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实验结论', 'en', N'Conclusion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序号', 'en', N'No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'卫生要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'卫生要求', 'en', N'Hygiene Requirement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'需求2（30*10*113）增加/改变值' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'需求2（30*10*113）增加/改变值', 'en', N'Req2 (30*10*113) Inc./Chg.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'需求2（35*13*107）增加/改变值' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'需求2（35*13*107）增加/改变值', 'en', N'Req2 (35*13*107) Inc./Chg.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'需求4（40.5*10*114）增加/改变值' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'需求4（40.5*10*114）增加/改变值', 'en', N'Req4 (40.5*10*114) Inc./Chg.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试要求', 'en', N'Test Requirements', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试装置及编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试装置及编号', 'en', N'Apparatus & No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试用仪器/检出限' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试用仪器/检出限', 'en', N'Instruments / Detection Limit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配方' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配方', 'en', N'Formula', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'样品编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'样品编号', 'en', N'Sample No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'密度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'密度', 'en', N'Density', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'前压（kpa)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'前压（kpa)', 'en', N'Upstream (kPa)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'后压（kpa)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'后压（kpa)', 'en', N'Downstream (kPa)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'压差（kpa)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'压差（kpa)', 'en', N'ΔP (kPa)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'0.5-1μm颗粒物去除率-2min（%）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'0.5-1μm颗粒物去除率-2min（%）', 'en', N'0.5-1μm Particle Removal-2min (%)', 'manual');
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('RD_ALKALINE','RD_MINERAL','RD_ANTIBACT','RD_SCALE','RD_RO_PROTECT','RD_SOAK','RD_DROP_PREC'));
PRINT N'数据记录表 7 面板字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
