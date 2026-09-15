-- migrate-qc-8sheets.sql — 品质管理八单据 doc 面板(文书式头部单,无明细行)
-- 来源: 收集客户资料/系统/系统资料-质量 YJ-QR-11/59/60/64/92/118/119/120
-- 范式: 同 migrate-rd-approval.sql(中文列 + 物理空明细表 + yj_panel/yj_field/yj_translation + 幂等)
--   doc 模式要求 line_table;八单均无明细行,用物理空表(勿用视图:doc 保存执行缺席软删 UPDATE,视图不可更新)
--   文档编号列参照 RD_APPROVAL.文档编号(隐藏字段,存文控号,供后续文书版式/导出取键)
SET NOCOUNT ON;

-- ══ 1. 不合格报告(制程) YJ-QR-11(qc_bhg,前缀 BHG) ══
IF OBJECT_ID('qc_bhg') IS NULL CREATE TABLE qc_bhg (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_bhg_docno DEFAULT N'YJ-QR-11',
  [填写部门] nvarchar(100) NULL,
  [填写人] nvarchar(50) NULL,
  [检验工站] nvarchar(100) NULL,
  [客户名称] nvarchar(200) NULL,
  [异常时间] nvarchar(20) NULL,
  [责任部门] nvarchar(100) NULL,
  [产品名称] nvarchar(200) NULL,
  [异常产品规格] nvarchar(200) NULL,
  [不合格品数量] decimal(18,4) NULL,
  [异常等级] nvarchar(20) NULL,
  [异常描述] nvarchar(2000) NULL,
  [原因分析] nvarchar(2000) NULL,
  [改善对策] nvarchar(2000) NULL,
  [效果跟踪] nvarchar(1000) NULL,
  [品质部意见] nvarchar(1000) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_bhg_detail') IS NULL CREATE TABLE qc_bhg_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 2. 不合格品处理单(制程) YJ-QR-59(qc_bhc,前缀 BHC) ══
IF OBJECT_ID('qc_bhc') IS NULL CREATE TABLE qc_bhc (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_bhc_docno DEFAULT N'YJ-QR-59',
  [客户名称] nvarchar(200) NULL,
  [产品编码] nvarchar(100) NULL,
  [产品名称] nvarchar(200) NULL,
  [产品规格] nvarchar(200) NULL,
  [生产量] decimal(18,4) NULL,
  [不合格品数量] decimal(18,4) NULL,
  [不合格品比例] nvarchar(20) NULL,
  [问题来源] nvarchar(20) NULL,
  [责任人] nvarchar(50) NULL,
  [问题描述] nvarchar(2000) NULL,
  [原因分析] nvarchar(2000) NULL,
  [性能验证] nvarchar(1000) NULL,
  [处理意见] nvarchar(20) NULL,
  [产品开发部性能意见] nvarchar(500) NULL,
  [产品开发部工艺意见] nvarchar(500) NULL,
  [销售部意见] nvarchar(500) NULL,
  [改善效果验证] nvarchar(1000) NULL,
  [材料费用] decimal(18,2) NULL,
  [人工费] decimal(18,2) NULL,
  [其他费用] decimal(18,2) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_bhc_detail') IS NULL CREATE TABLE qc_bhc_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 3. 特采申请单 YJ-QR-60(qc_tc,前缀 TC) ══
IF OBJECT_ID('qc_tc') IS NULL CREATE TABLE qc_tc (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_tc_docno DEFAULT N'YJ-QR-60',
  [供应商] nvarchar(200) NULL,
  [采购单号] nvarchar(60) NULL,
  [产品名称] nvarchar(200) NULL,
  [总数量] decimal(18,4) NULL,
  [不合格品数量] decimal(18,4) NULL,
  [不合格品比例] nvarchar(20) NULL,
  [不良说明] nvarchar(1000) NULL,
  [严重程度] nvarchar(20) NULL,
  [特采理由] nvarchar(1000) NULL,
  [产品开发部性能意见] nvarchar(500) NULL,
  [产品开发部工艺意见] nvarchar(500) NULL,
  [品质部意见] nvarchar(500) NULL,
  [销售部意见] nvarchar(500) NULL,
  [研发意见] nvarchar(500) NULL,
  [最终处理结果] nvarchar(20) NULL,
  [编制人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
ELSE IF COL_LENGTH('qc_tc','编制人') IS NULL ALTER TABLE qc_tc ADD [编制人] nvarchar(50) NULL;
IF OBJECT_ID('qc_tc_detail') IS NULL CREATE TABLE qc_tc_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 4. 不合格品处理单(自制物料) YJ-QR-64(qc_bhz,前缀 BHZ) ══
IF OBJECT_ID('qc_bhz') IS NULL CREATE TABLE qc_bhz (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_bhz_docno DEFAULT N'YJ-QR-64',
  [物料名称] nvarchar(200) NULL,
  [物料编码] nvarchar(100) NULL,
  [物料批次] nvarchar(60) NULL,
  [生产数量] decimal(18,4) NULL,
  [问题来源] nvarchar(20) NULL,
  [责任人] nvarchar(50) NULL,
  [问题描述] nvarchar(2000) NULL,
  [原因分析] nvarchar(2000) NULL,
  [性能验证] nvarchar(1000) NULL,
  [处理意见] nvarchar(20) NULL,
  [研发部意见] nvarchar(500) NULL,
  [产品开发部意见] nvarchar(500) NULL,
  [改善效果验证] nvarchar(1000) NULL,
  [材料费用] decimal(18,2) NULL,
  [人工费] decimal(18,2) NULL,
  [其他费用] decimal(18,2) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_bhz_detail') IS NULL CREATE TABLE qc_bhz_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 5. 紧急放行申请单 YJ-QR-92(qc_jjf,前缀 JJF) ══
IF OBJECT_ID('qc_jjf') IS NULL CREATE TABLE qc_jjf (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_jjf_docno DEFAULT N'YJ-QR-92',
  [物料类型] nvarchar(20) NULL,
  [物料名称] nvarchar(200) NULL,
  [物料编码] nvarchar(100) NULL,
  [申请放行数量] decimal(18,4) NULL,
  [批次号] nvarchar(60) NULL,
  [紧急放行原因] nvarchar(2000) NULL,
  [产品开发部性能意见] nvarchar(500) NULL,
  [产品开发部工艺意见] nvarchar(500) NULL,
  [品质部意见] nvarchar(500) NULL,
  [检测结果] nvarchar(1000) NULL,
  [检测人] nvarchar(50) NULL,
  [责任人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
ELSE IF COL_LENGTH('qc_jjf','责任人') IS NULL ALTER TABLE qc_jjf ADD [责任人] nvarchar(50) NULL;
IF OBJECT_ID('qc_jjf_detail') IS NULL CREATE TABLE qc_jjf_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 6. 试产材料使用申请单 YJ-QR-118(qc_scp,前缀 SCP) ══
IF OBJECT_ID('qc_scp') IS NULL CREATE TABLE qc_scp (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_scp_docno DEFAULT N'YJ-QR-118',
  [物料名称] nvarchar(200) NULL,
  [物料编码] nvarchar(100) NULL,
  [物料批次] nvarchar(60) NULL,
  [生产量] decimal(18,4) NULL,
  [责任人] nvarchar(50) NULL,
  [材料来源描述] nvarchar(2000) NULL,
  [测试结果] nvarchar(2000) NULL,
  [研发部意见] nvarchar(500) NULL,
  [产品开发部意见] nvarchar(500) NULL,
  [品质部意见] nvarchar(500) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_scp_detail') IS NULL CREATE TABLE qc_scp_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 7. 来料异常分析报告 YJ-QR-119(qc_lyb,前缀 LYB) ══
IF OBJECT_ID('qc_lyb') IS NULL CREATE TABLE qc_lyb (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_lyb_docno DEFAULT N'YJ-QR-119',
  [供应商] nvarchar(200) NULL,
  [物料批次] nvarchar(60) NULL,
  [物料名称] nvarchar(200) NULL,
  [来料数量] decimal(18,4) NULL,
  [物料编码] nvarchar(100) NULL,
  [不良率] nvarchar(20) NULL,
  [异常描述] nvarchar(2000) NULL,
  [供应商原因] nvarchar(1000) NULL,
  [内部原因] nvarchar(1000) NULL,
  [处理方式] nvarchar(20) NULL,
  [改善追踪结果] nvarchar(1000) NULL,
  [编制人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
ELSE IF COL_LENGTH('qc_lyb','编制人') IS NULL ALTER TABLE qc_lyb ADD [编制人] nvarchar(50) NULL;
IF OBJECT_ID('qc_lyb_detail') IS NULL CREATE TABLE qc_lyb_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
-- ══ 8. 生产异常分析报告 YJ-QR-120(qc_scy,前缀 SCY) ══
IF OBJECT_ID('qc_scy') IS NULL CREATE TABLE qc_scy (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_scy_docno DEFAULT N'YJ-QR-120',
  [产品物料名称] nvarchar(200) NULL,
  [产品物料批次] nvarchar(60) NULL,
  [产品物料编码] nvarchar(100) NULL,
  [生产量] decimal(18,4) NULL,
  [异常描述] nvarchar(2000) NULL,
  [原因分析] nvarchar(2000) NULL,
  [改善对策] nvarchar(2000) NULL,
  [效果跟踪] nvarchar(1000) NULL,
  [品质部意见] nvarchar(1000) NULL,
  [编制人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
ELSE IF COL_LENGTH('qc_scy','编制人') IS NULL ALTER TABLE qc_scy ADD [编制人] nvarchar(50) NULL;
IF OBJECT_ID('qc_scy_detail') IS NULL CREATE TABLE qc_scy_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO

-- ══ 9. 面板注册(doc 模式,品质管理分组;前缀已核对 s_allno/yj_panel 无冲突) ══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_BHG') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_BHG', N'不合格报告(制程)', N'单据', 'doc', 'qc_bhg_detail', 'qc_bhg', N'单据编号', N'id', N'单据编号', N'BHG', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_BHC') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_BHC', N'不合格品处理单(制程)', N'单据', 'doc', 'qc_bhc_detail', 'qc_bhc', N'单据编号', N'id', N'单据编号', N'BHC', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_TC') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_TC', N'特采申请单', N'单据', 'doc', 'qc_tc_detail', 'qc_tc', N'单据编号', N'id', N'单据编号', N'TC', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_BHZ') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_BHZ', N'不合格品处理单(自制物料)', N'单据', 'doc', 'qc_bhz_detail', 'qc_bhz', N'单据编号', N'id', N'单据编号', N'BHZ', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_JJF') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_JJF', N'紧急放行申请单', N'单据', 'doc', 'qc_jjf_detail', 'qc_jjf', N'单据编号', N'id', N'单据编号', N'JJF', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_SCP') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_SCP', N'试产材料使用申请单', N'单据', 'doc', 'qc_scp_detail', 'qc_scp', N'单据编号', N'id', N'单据编号', N'SCP', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_LYB') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_LYB', N'来料异常分析报告', N'单据', 'doc', 'qc_lyb_detail', 'qc_lyb', N'单据编号', N'id', N'单据编号', N'LYB', N'单据日期', 20, 'items', N'品质管理');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_SCY') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_SCY', N'生产异常分析报告', N'单据', 'doc', 'qc_scy_detail', 'qc_scy', N'单据编号', N'id', N'单据编号', N'SCY', N'单据日期', 20, 'items', N'品质管理');
GO

-- ══ 10. 字段(q=query,h=header;place/seq/width/editable/required 同 qc-3docs 口径) ══
-- 不合格报告(制程)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'填写部门') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'填写部门', N'填写部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'query,header', 30, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'填写人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'填写人', N'填写人', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'检验工站') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'检验工站', N'检验工站', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'客户名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'客户名称', N'客户名称', N'参照', NULL, N'KHDA', N'mc', N'mc', N'query,header', 60, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'异常时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'异常时间', N'异常时间', N'日期', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'责任部门') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'责任部门', N'责任部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'query,header', 80, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'query,header', 90, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'异常产品规格') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'异常产品规格', N'异常产品规格', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'不合格品数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'不合格品数量', N'不合格品数量', N'小数', NULL, NULL, NULL, NULL, N'header', 110, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'异常等级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'异常等级', N'异常等级', N'下拉框', N'SELECT v FROM (VALUES (N''一般不合格''),(N''严重不合格'')) AS t(v)', NULL, NULL, NULL, N'query,header', 120, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'异常描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'异常描述', N'异常描述', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'原因分析') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'原因分析', N'原因分析', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'改善对策') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'改善对策', N'改善对策', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'效果跟踪') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'效果跟踪', N'效果跟踪', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 190, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHG' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHG', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 215, 120, 1, 0, 1, 1);
GO
-- 不合格品处理单(制程)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'客户名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'客户名称', N'客户名称', N'参照', NULL, N'KHDA', N'mc', N'mc', N'query,header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'产品编码', N'产品编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 40, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'产品规格') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'产品规格', N'产品规格', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'生产量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'生产量', N'生产量', N'小数', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'不合格品数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'不合格品数量', N'不合格品数量', N'小数', NULL, NULL, NULL, NULL, N'header', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'不合格品比例') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'不合格品比例', N'不合格品比例', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'问题来源') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'问题来源', N'问题来源', N'下拉框', N'SELECT v FROM (VALUES (N''成型''),(N''组装'')) AS t(v)', NULL, NULL, NULL, N'query,header', 100, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'责任人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'问题描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'问题描述', N'问题描述', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'原因分析') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'原因分析', N'原因分析', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'性能验证') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'性能验证', N'性能验证', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'处理意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'处理意见', N'处理意见', N'下拉框', N'SELECT v FROM (VALUES (N''返工达到规定要求''),(N''让步使用''),(N''报废''),(N''筛选合格品留用'')) AS t(v)', NULL, NULL, NULL, N'query,header', 150, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'产品开发部性能意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'产品开发部性能意见', N'产品开发部性能意见', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'产品开发部工艺意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'产品开发部工艺意见', N'产品开发部工艺意见', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'销售部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'销售部意见', N'销售部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'改善效果验证') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'改善效果验证', N'改善效果验证', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'材料费用') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'材料费用', N'材料费用', N'小数', NULL, NULL, NULL, NULL, N'header', 200, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'人工费') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'人工费', N'人工费', N'小数', NULL, NULL, NULL, NULL, N'header', 210, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'其他费用') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'其他费用', N'其他费用', N'小数', NULL, NULL, NULL, NULL, N'header', 220, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 230, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 240, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 250, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHC' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHC', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 265, 120, 1, 0, 1, 1);
GO
-- 特采申请单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 30, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'采购单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'采购单号', N'采购单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'query,header', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'总数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'总数量', N'总数量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'不合格品数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'不合格品数量', N'不合格品数量', N'小数', NULL, NULL, NULL, NULL, N'header', 70, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'不合格品比例') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'不合格品比例', N'不合格品比例', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'不良说明') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'不良说明', N'不良说明', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'严重程度') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'严重程度', N'严重程度', N'下拉框', N'SELECT v FROM (VALUES (N''严重''),(N''一般''),(N''轻微'')) AS t(v)', NULL, NULL, NULL, N'query,header', 100, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'特采理由') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'特采理由', N'特采理由', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'产品开发部性能意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'产品开发部性能意见', N'产品开发部性能意见', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'产品开发部工艺意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'产品开发部工艺意见', N'产品开发部工艺意见', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'销售部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'销售部意见', N'销售部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'研发意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'研发意见', N'研发意见', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'最终处理结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'最终处理结果', N'最终处理结果', N'下拉框', N'SELECT v FROM (VALUES (N''正常使用''),(N''挑选使用'')) AS t(v)', NULL, NULL, NULL, N'query,header', 170, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 190, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 215, 120, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'编制人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC', N'编制人', N'编制人', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 100, 1, 0, 0, 1);
GO
-- 不合格品处理单(自制物料)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 40, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'物料批次') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'物料批次', N'物料批次', N'文本', NULL, NULL, NULL, NULL, N'query,header', 50, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'生产数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'生产数量', N'生产数量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'问题来源') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'问题来源', N'问题来源', N'下拉框', N'SELECT v FROM (VALUES (N''制程''),(N''成品'')) AS t(v)', NULL, NULL, NULL, N'query,header', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'责任人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'问题描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'问题描述', N'问题描述', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'原因分析') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'原因分析', N'原因分析', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'性能验证') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'性能验证', N'性能验证', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'处理意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'处理意见', N'处理意见', N'下拉框', N'SELECT v FROM (VALUES (N''返工达到规定要求''),(N''让步使用''),(N''报废''),(N''筛选合格品留用'')) AS t(v)', NULL, NULL, NULL, N'query,header', 120, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'研发部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'研发部意见', N'研发部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'产品开发部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'产品开发部意见', N'产品开发部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'改善效果验证') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'改善效果验证', N'改善效果验证', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'材料费用') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'材料费用', N'材料费用', N'小数', NULL, NULL, NULL, NULL, N'header', 160, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'人工费') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'人工费', N'人工费', N'小数', NULL, NULL, NULL, NULL, N'header', 170, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'其他费用') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'其他费用', N'其他费用', N'小数', NULL, NULL, NULL, NULL, N'header', 180, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 200, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_BHZ' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_BHZ', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 225, 120, 1, 0, 1, 1);
GO
-- 紧急放行申请单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'物料类型') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'物料类型', N'物料类型', N'下拉框', N'SELECT v FROM (VALUES (N''外部来料''),(N''自制物料'')) AS t(v)', NULL, NULL, NULL, N'query,header', 30, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 50, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'申请放行数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'申请放行数量', N'申请放行数量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'批次号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'批次号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 70, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'紧急放行原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'紧急放行原因', N'紧急放行原因', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'产品开发部性能意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'产品开发部性能意见', N'产品开发部性能意见', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'产品开发部工艺意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'产品开发部工艺意见', N'产品开发部工艺意见', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'检测结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'检测结果', N'检测结果', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'检测人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'检测人', N'检测人', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 150, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 175, 120, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_JJF' AND col_name=N'责任人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_JJF', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 100, 1, 0, 0, 1);
GO
-- 试产材料使用申请单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 40, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'物料批次') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'物料批次', N'物料批次', N'文本', NULL, NULL, NULL, NULL, N'query,header', 50, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'生产量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'生产量', N'生产量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'责任人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'材料来源描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'材料来源描述', N'材料来源描述', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'测试结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'测试结果', N'测试结果', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'研发部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'研发部意见', N'研发部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'产品开发部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'产品开发部意见', N'产品开发部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 140, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCP' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCP', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 165, 120, 1, 0, 1, 1);
GO
-- 来料异常分析报告
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 30, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'物料批次') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'物料批次', N'物料批次', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'来料数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'来料数量', N'来料数量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 70, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'不良率') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'不良率', N'不良率', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'异常描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'异常描述', N'异常描述', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'供应商原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'供应商原因', N'供应商原因', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'内部原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'内部原因', N'内部原因', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'处理方式') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'处理方式', N'处理方式', N'下拉框', N'SELECT v FROM (VALUES (N''整批退货''),(N''全检挑选''),(N''让步接收'')) AS t(v)', NULL, NULL, NULL, N'query,header', 120, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'改善追踪结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'改善追踪结果', N'改善追踪结果', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 150, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 175, 120, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_LYB' AND col_name=N'编制人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_LYB', N'编制人', N'编制人', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 100, 1, 0, 0, 1);
GO
-- 生产异常分析报告
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'产品物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'产品物料名称', N'产品/物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'产品物料批次') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'产品物料批次', N'产品/物料批次', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'产品物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'产品物料编码', N'产品/物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 50, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'生产量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'生产量', N'生产量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'异常描述') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'异常描述', N'异常描述', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'原因分析') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'原因分析', N'原因分析', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'改善对策') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'改善对策', N'改善对策', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'效果跟踪') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'效果跟踪', N'效果跟踪', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 130, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 155, 120, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_SCY' AND col_name=N'编制人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_SCY', N'编制人', N'编制人', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 100, 1, 0, 0, 1);
GO

-- ══ 11. en 译名(面板 + 字段标签/字典值;共享标签已存在则幂等跳过;其它语言实时机翻兜底) ══
-- 面板
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'不合格报告(制程)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'不合格报告(制程)', 'en', N'Nonconformance Report (Process)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'不合格品处理单(制程)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'不合格品处理单(制程)', 'en', N'Nonconforming Product Disposition (Process)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'特采申请单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'特采申请单', 'en', N'Special Procurement Application', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'不合格品处理单(自制物料)' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'不合格品处理单(自制物料)', 'en', N'Nonconforming Product Disposition (Self-made Material)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'紧急放行申请单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'紧急放行申请单', 'en', N'Emergency Release Application', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'试产材料使用申请单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'试产材料使用申请单', 'en', N'Trial Material Usage Application', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料异常分析报告' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料异常分析报告', 'en', N'Incoming Material Abnormality Analysis Report', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'生产异常分析报告' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'生产异常分析报告', 'en', N'Production Abnormality Analysis Report', 'manual');
-- 字段标签(显示键=label,含斜杠)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'填写部门' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'填写部门', 'en', N'Filling Department', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'填写人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'填写人', 'en', N'Filled By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验工站' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验工站', 'en', N'Inspection Station', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'异常时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'异常时间', 'en', N'Abnormality Time', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'责任部门' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'责任部门', 'en', N'Responsible Department', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'异常产品规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'异常产品规格', 'en', N'Abnormal Product Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不合格品数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不合格品数量', 'en', N'Rejected Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'异常等级' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'异常等级', 'en', N'Abnormality Level', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'异常描述' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'异常描述', 'en', N'Abnormality Description', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原因分析' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原因分析', 'en', N'Cause Analysis', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'改善对策' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'改善对策', 'en', N'Corrective Action', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'效果跟踪' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'效果跟踪', 'en', N'Effect Follow-up', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质部意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质部意见', 'en', N'QC Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品编码', 'en', N'Product Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品规格', 'en', N'Product Specification', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产量', 'en', N'Production Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不合格品比例' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不合格品比例', 'en', N'Rejected Ratio', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'问题来源' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'问题来源', 'en', N'Problem Source', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'责任人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'责任人', 'en', N'Responsible Person', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'问题描述' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'问题描述', 'en', N'Problem Description', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'性能验证' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'性能验证', 'en', N'Performance Verification', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处理意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处理意见', 'en', N'Disposition', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品开发部性能意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品开发部性能意见', 'en', N'Product Dev. Performance Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品开发部工艺意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品开发部工艺意见', 'en', N'Product Dev. Process Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售部意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售部意见', 'en', N'Sales Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'改善效果验证' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'改善效果验证', 'en', N'Improvement Effect Verification', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'材料费用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'材料费用', 'en', N'Material Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'人工费' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'人工费', 'en', N'Labor Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'其他费用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'其他费用', 'en', N'Other Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购单号', 'en', N'PO No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总数量', 'en', N'Total Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不良说明' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不良说明', 'en', N'Defect Description', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'严重程度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'严重程度', 'en', N'Severity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特采理由' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特采理由', 'en', N'Special Procurement Reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'研发意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'研发意见', 'en', N'R&D Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最终处理结果' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最终处理结果', 'en', N'Final Disposition', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料批次' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料批次', 'en', N'Material Batch', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'生产数量', 'en', N'Production Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'研发部意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'研发部意见', 'en', N'R&D Dept Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品开发部意见' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品开发部意见', 'en', N'Product Development Opinion', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料类型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料类型', 'en', N'Material Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'申请放行数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'申请放行数量', 'en', N'Release Qty Applied', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批次号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批次号', 'en', N'Batch No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'紧急放行原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'紧急放行原因', 'en', N'Emergency Release Reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测结果' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测结果', 'en', N'Test Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测人', 'en', N'Tester', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'编制人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'编制人', 'en', N'Prepared by', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'材料来源描述' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'材料来源描述', 'en', N'Material Source Description', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试结果' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试结果', 'en', N'Test Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来料数量', 'en', N'Incoming Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不良率' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不良率', 'en', N'Defect Rate', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商原因', 'en', N'Supplier Cause', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'内部原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'内部原因', 'en', N'Internal Cause', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处理方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处理方式', 'en', N'Disposal Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'改善追踪结果' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'改善追踪结果', 'en', N'Improvement Tracking Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品/物料名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品/物料名称', 'en', N'Product/Material Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品/物料批次' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品/物料批次', 'en', N'Product/Material Batch', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品/物料编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品/物料编码', 'en', N'Product/Material Code', 'manual');
-- 字典值(field scope,同 qc-3docs 让步接收先例)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'一般不合格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'一般不合格', 'en', N'Minor Nonconformance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'严重不合格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'严重不合格', 'en', N'Major Nonconformance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成型', 'en', N'Molding', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'组装' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'组装', 'en', N'Assembly', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'返工达到规定要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'返工达到规定要求', 'en', N'Rework to Specification', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'让步使用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'让步使用', 'en', N'Concession Use', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报废' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报废', 'en', N'Scrap', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'筛选合格品留用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'筛选合格品留用', 'en', N'Screen and Keep Qualified', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'严重' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'严重', 'en', N'Critical', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'一般' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'一般', 'en', N'Major', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'轻微' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'轻微', 'en', N'Minor', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'正常使用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'正常使用', 'en', N'Normal Use', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'挑选使用' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'挑选使用', 'en', N'Use After Sorting', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'制程' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'制程', 'en', N'In-Process', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成品' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成品', 'en', N'Finished Product', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部来料' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部来料', 'en', N'External Incoming Material', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'自制物料' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'自制物料', 'en', N'Self-made Material', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整批退货' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整批退货', 'en', N'Full Batch Return', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'全检挑选' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'全检挑选', 'en', N'Full Inspection and Sorting', 'manual');
GO

PRINT N'migrate-qc-8sheets 完成:八单十六表+八面板+字段+en 译名';
GO
