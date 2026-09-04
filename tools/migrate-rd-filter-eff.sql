-- migrate-rd-filter-eff.sql — 功能性滤效 数据记录表(报告式文件面板,按《04数据记录表.xlsx》功能滤效一比一复刻)
-- 报告头(公司名/测试主题/右上 YJ-PD-01 信息块)+ 1.基本信息 + 2.测试条件 + 3.数据记录表(动态行)
SET NOCOUNT ON;
BEGIN TRY
IF OBJECT_ID('rd_filter_eff_head') IS NULL CREATE TABLE rd_filter_eff_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_rfe_docno DEFAULT N'YJ-PD-01',
  [密级] nvarchar(20) NULL,
  [适用范围] nvarchar(50) NULL,
  [测试负责人] nvarchar(50) NULL,
  [测试编号] nvarchar(60) NULL,
  [测试主题] nvarchar(200) NULL,
  [测试目的/背景] nvarchar(500) NULL,
  [规格] nvarchar(200) NULL,
  [样品配方] nvarchar(300) NULL,
  [样品信息1] nvarchar(2000) NULL,
  [样品信息2] nvarchar(2000) NULL,
  [测试要求] nvarchar(1000) NULL,
  [测试标准] nvarchar(300) NULL,
  [测试时间] nvarchar(200) NULL,
  [本次实验目的] nvarchar(2000) NULL,
  [测试装置及编号1] nvarchar(200) NULL,
  [测试装置及编号2] nvarchar(200) NULL,
  [加标方式] nvarchar(1000) NULL,
  [冲水方式] nvarchar(2000) NULL,
  [测试用仪器/检出限] nvarchar(500) NULL,
  [原水自来水] nvarchar(20) NULL,
  [原水纯水] nvarchar(20) NULL,
  [原水超纯水] nvarchar(20) NULL,
  [原水PH] nvarchar(20) NULL,
  [原水TDS] nvarchar(20) NULL,
  [缸内自来水VOC浓度] nvarchar(50) NULL,
  [自来水加氯浓度] nvarchar(50) NULL,
  [水温] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_filter_eff_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_filter_eff_detail') IS NULL CREATE TABLE rd_filter_eff_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [冲水时间] nvarchar(100) NULL,
  [累计进水L] nvarchar(50) NULL,
  [水温] nvarchar(50) NULL,
  [压力样品1] nvarchar(50) NULL,
  [压力样品2] nvarchar(50) NULL,
  [流速样品1] nvarchar(50) NULL,
  [流速样品2] nvarchar(50) NULL,
  [原水含量5号缸] nvarchar(50) NULL,
  [出水样品1] nvarchar(50) NULL,
  [出水样品2] nvarchar(50) NULL,
  [去除率样品1] nvarchar(50) NULL,
  [去除率样品2] nvarchar(50) NULL,
  [测试时间] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_filter_eff_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_filter_eff_detail', head_table=N'rd_filter_eff_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'FE', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_FILTER_EFF';
GO
-- 旧通用网格字段全部替换为报告字段(脚本幂等:每次重建)
DELETE FROM yj_field WHERE panel_code='RD_FILTER_EFF';
GO
-- 查询字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试主题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_FILTER_EFF' AND col_name=N'测试编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_FILTER_EFF', N'测试编号', N'测试编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
-- 表头字段(报告字段;文书特例渲染)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_FILTER_EFF', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_FILTER_EFF', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_FILTER_EFF', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 80, 1, 0, 0, 1),
('RD_FILTER_EFF', N'适用范围', N'适用范围', N'下拉框', N'SELECT v FROM (VALUES (N''银嘉内部''),(N''公司内''),(N''工程技术中心''),(N''客户项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试负责人', N'测试负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试编号', N'测试编号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 1, 1),
('RD_FILTER_EFF', N'测试主题', N'测试主题', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 220, 1, 1, 0, 1),
('RD_FILTER_EFF', N'测试目的/背景', N'测试目的/背景', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'规格', N'规格', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'样品配方', N'样品配方', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'样品信息1', N'样品信息1', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'样品信息2', N'样品信息2', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试要求', N'测试要求', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'本次实验目的', N'本次实验目的', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试装置及编号1', N'测试装置及编号1', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试装置及编号2', N'测试装置及编号2', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 160, 1, 0, 0, 1),
('RD_FILTER_EFF', N'加标方式', N'加标方式', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'冲水方式', N'冲水方式', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 200, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试用仪器/检出限', N'测试用仪器/检出限', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 220, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水自来水', N'原水自来水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 230, 80, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水纯水', N'原水纯水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 240, 80, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水超纯水', N'原水超纯水', N'下拉框', N'SELECT v FROM (VALUES (N''√''),(N''×'')) AS t(v)', NULL, NULL, NULL, N'header', 250, 80, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水PH', N'原水PH', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 90, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水TDS', N'原水TDS', N'文本', NULL, NULL, NULL, NULL, N'header', 270, 90, 1, 0, 0, 1),
('RD_FILTER_EFF', N'缸内自来水VOC浓度', N'缸内自来水VOC浓度', N'文本', NULL, NULL, NULL, NULL, N'header', 280, 120, 1, 0, 0, 1),
('RD_FILTER_EFF', N'自来水加氯浓度', N'自来水加氯浓度', N'文本', NULL, NULL, NULL, NULL, N'header', 290, 120, 1, 0, 0, 1),
('RD_FILTER_EFF', N'水温', N'水温', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 90, 1, 0, 0, 1),
('RD_FILTER_EFF', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 160, 1, 0, 0, 1);
GO
-- 明细字段(3.数据记录表)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_FILTER_EFF', N'冲水时间', N'冲水时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'累计进水L', N'累计进水（L）', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'水温', N'水温（℃）', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 90, 1, 0, 0, 1),
('RD_FILTER_EFF', N'压力样品1', N'压力（PSI)样品1', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'压力样品2', N'压力（PSI)样品2', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'流速样品1', N'流速（L/min)样品1', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'流速样品2', N'流速（L/min)样品2', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'原水含量5号缸', N'原水含量（ug/L）5号缸', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 130, 1, 0, 0, 1),
('RD_FILTER_EFF', N'出水样品1', N'出水含量（ug/L）样品1', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 140, 1, 0, 0, 1),
('RD_FILTER_EFF', N'出水样品2', N'出水含量（ug/L）样品2', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 140, 1, 0, 0, 1),
('RD_FILTER_EFF', N'去除率样品1', N'去除率%样品1', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'去除率样品2', N'去除率%样品2', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 110, 1, 0, 0, 1),
('RD_FILTER_EFF', N'测试时间', N'测试时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 1, 0, 0, 1);
GO
