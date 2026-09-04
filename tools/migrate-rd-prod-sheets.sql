-- migrate-rd-prod-sheets.sql — 产品文件 6 面板(成型工艺清单/成型配方/组装BOM/组装工艺/规格书/出货检验计划)
-- 按产品开发《2.产品文件》各原文档复刻;文书面板模式:head/detail 双表 + 中文列(幂等)
SET NOCOUNT ON;
GO

-- ═══════════════ 1. 成型工艺清单 RD_MOLD_PROC(纯表单,无明细行) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_mold_proc_head') IS NULL CREATE TABLE rd_mold_proc_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [表单管理人] nvarchar(50) NULL,
  [密级] nvarchar(20) NULL,
  [使用范围] nvarchar(60) NULL,
  [版本号] nvarchar(30) NULL,
  [产品编号] nvarchar(50) NULL,
  [产品名称] nvarchar(100) NULL,
  [炭棒规格1] nvarchar(30) NULL,
  [炭棒规格2] nvarchar(30) NULL,
  [炭棒规格3] nvarchar(30) NULL,
  [产品管控类型] nvarchar(50) NULL,
  [外观要求] nvarchar(50) NULL,
  [生产车间] nvarchar(50) NULL,
  [理论最低灌料重量g] nvarchar(50) NULL,
  [理论灌料中间值g] nvarchar(50) NULL,
  [理论最高灌料重量g] nvarchar(50) NULL,
  [理论水分] nvarchar(50) NULL,
  [实际灌料重量计算公式] nvarchar(500) NULL,
  [烧结炉参数] nvarchar(100) NULL,
  [烧结时间调速器参数] nvarchar(100) NULL,
  [热压要求] nvarchar(100) NULL,
  [冷却参数设置] nvarchar(100) NULL,
  [长度要求] nvarchar(100) NULL,
  [重量要求] nvarchar(100) NULL,
  [最短长度mm] nvarchar(50) NULL,
  [中间值mm] nvarchar(50) NULL,
  [最长长度mm] nvarchar(50) NULL,
  [最低重量g] nvarchar(50) NULL,
  [中间值g] nvarchar(50) NULL,
  [最高重量g] nvarchar(50) NULL,
  [外径mm] nvarchar(50) NULL,
  [外径公差] nvarchar(50) NULL,
  [内径mm] nvarchar(50) NULL,
  [内径公差] nvarchar(50) NULL,
  [内孔要求] nvarchar(50) NULL,
  [密度管控要求] nvarchar(200) NULL,
  [实际密度管控下限] nvarchar(50) NULL,
  [实际密度管控上限] nvarchar(50) NULL,
  [跌落高度cm] nvarchar(50) NULL,
  [跌落次数] nvarchar(50) NULL,
  [跌落要求] nvarchar(100) NULL,
  [测试间距mm] nvarchar(50) NULL,
  [压头下降速度] nvarchar(50) NULL,
  [强度要求kgf] nvarchar(50) NULL,
  [压降测试管路] nvarchar(50) NULL,
  [压降测试流速] nvarchar(50) NULL,
  [压降标准kpa] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mold_proc_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
-- 纯表单无明细:占位明细表(引擎空明细保存时会软删行表,不能与头表同表)
BEGIN TRY
IF OBJECT_ID('rd_mold_proc_detail') IS NULL CREATE TABLE rd_mold_proc_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mold_proc_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_proc_detail TO yinjia;
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_mold_proc_detail', head_table=N'rd_mold_proc_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'MP', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_MOLD_PROC';
GO
DELETE FROM yj_field WHERE panel_code='RD_MOLD_PROC';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'产品编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name=N'产品名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_PROC', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_MOLD_PROC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_MOLD_PROC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_MOLD_PROC', N'表单管理人', N'表单管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'使用范围', N'使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''工艺科/成型车间''),(N''工程技术中心''),(N''银嘉内部''),(N''公司内'')) AS t(v)', NULL, NULL, NULL, N'header', 50, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 1, 0, 1),
('RD_MOLD_PROC', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 1, 0, 1),
('RD_MOLD_PROC', N'炭棒规格1', N'炭棒规格（1）', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'炭棒规格2', N'炭棒规格（2）', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'炭棒规格3', N'炭棒规格（3）', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'产品管控类型', N'产品管控类型', N'下拉框', N'SELECT v FROM (VALUES (N''·重点管控产品''),(N''·一般管控产品'')) AS t(v)', NULL, NULL, NULL, N'header', 120, 120, 1, 0, 0, 1),
('RD_MOLD_PROC', N'外观要求', N'外观要求', N'下拉框', N'SELECT v FROM (VALUES (N''·成品''),(N''·半成品'')) AS t(v)', NULL, NULL, NULL, N'header', 130, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'生产车间', N'生产车间', N'下拉框', N'SELECT v FROM (VALUES (N''·4#''),(N''·1#''),(N''·2#''),(N''·3#'')) AS t(v)', NULL, NULL, NULL, N'header', 140, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'理论最低灌料重量g', N'理论最低灌料重量g', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'理论灌料中间值g', N'理论灌料中间值g', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'理论最高灌料重量g', N'理论最高灌料重量g', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'理论水分', N'理论水分', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'实际灌料重量计算公式', N'实际灌料重量计算公式', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 220, 1, 0, 0, 1),
('RD_MOLD_PROC', N'烧结炉参数', N'烧结炉参数', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'烧结时间调速器参数', N'烧结时间/调速器参数', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'热压要求', N'热压要求', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'冷却参数设置', N'冷却参数设置', N'文本', NULL, NULL, NULL, NULL, N'header', 230, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'长度要求', N'长度要求', N'文本', NULL, NULL, NULL, NULL, N'header', 240, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'重量要求', N'重量要求', N'文本', NULL, NULL, NULL, NULL, N'header', 250, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'最短长度mm', N'最短长度mm', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'中间值mm', N'中间值mm', N'文本', NULL, NULL, NULL, NULL, N'header', 270, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'最长长度mm', N'最长长度mm', N'文本', NULL, NULL, NULL, NULL, N'header', 280, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'最低重量g', N'最低重量g', N'文本', NULL, NULL, NULL, NULL, N'header', 290, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'中间值g', N'中间值g', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'最高重量g', N'最高重量g', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'外径mm', N'外径mm', N'文本', NULL, NULL, NULL, NULL, N'header', 320, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'外径公差', N'外径公差', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'内径mm', N'内径mm', N'文本', NULL, NULL, NULL, NULL, N'header', 340, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'内径公差', N'内径公差', N'文本', NULL, NULL, NULL, NULL, N'header', 350, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'内孔要求', N'内孔要求', N'文本', NULL, NULL, NULL, NULL, N'header', 360, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'密度管控要求', N'密度管控要求', N'文本', NULL, NULL, NULL, NULL, N'header', 370, 180, 1, 0, 0, 1),
('RD_MOLD_PROC', N'实际密度管控下限', N'实际密度管控下限', N'文本', NULL, NULL, NULL, NULL, N'header', 380, 110, 1, 0, 0, 1),
('RD_MOLD_PROC', N'实际密度管控上限', N'实际密度管控上限', N'文本', NULL, NULL, NULL, NULL, N'header', 390, 110, 1, 0, 0, 1),
('RD_MOLD_PROC', N'跌落高度cm', N'高度cm', N'文本', NULL, NULL, NULL, NULL, N'header', 400, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'跌落次数', N'跌落次数', N'文本', NULL, NULL, NULL, NULL, N'header', 410, 80, 1, 0, 0, 1),
('RD_MOLD_PROC', N'跌落要求', N'要求', N'文本', NULL, NULL, NULL, NULL, N'header', 420, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'测试间距mm', N'测试间距mm', N'文本', NULL, NULL, NULL, NULL, N'header', 430, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'压头下降速度', N'压头下降速度mm/min', N'文本', NULL, NULL, NULL, NULL, N'header', 440, 130, 1, 0, 0, 1),
('RD_MOLD_PROC', N'强度要求kgf', N'强度要求kgf', N'文本', NULL, NULL, NULL, NULL, N'header', 450, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'压降测试管路', N'测试管路', N'文本', NULL, NULL, NULL, NULL, N'header', 460, 90, 1, 0, 0, 1),
('RD_MOLD_PROC', N'压降测试流速', N'测试流速L/min', N'文本', NULL, NULL, NULL, NULL, N'header', 470, 110, 1, 0, 0, 1),
('RD_MOLD_PROC', N'压降标准kpa', N'压降标准kpa', N'文本', NULL, NULL, NULL, NULL, N'header', 480, 100, 1, 0, 0, 1),
('RD_MOLD_PROC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 490, 160, 1, 0, 0, 1);
GO

-- ═══════════════ 2. 成型配方 RD_MOLD_FORMULA ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_mold_formula_head') IS NULL CREATE TABLE rd_mold_formula_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [表单管理人] nvarchar(50) NULL,
  [密级] nvarchar(20) NULL,
  [使用范围] nvarchar(60) NULL,
  [版本号] nvarchar(30) NULL,
  [产品编号] nvarchar(50) NULL,
  [产品名称] nvarchar(100) NULL,
  [炭棒规格1] nvarchar(30) NULL,
  [炭棒规格2] nvarchar(30) NULL,
  [炭棒规格3] nvarchar(30) NULL,
  [产品管控类型] nvarchar(50) NULL,
  [外观要求] nvarchar(50) NULL,
  [生产车间] nvarchar(50) NULL,
  [配料要求] nvarchar(1000) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mold_formula_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_mold_formula_detail') IS NULL CREATE TABLE rd_mold_formula_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [序号] nvarchar(20) NULL,
  [物料种类] nvarchar(50) NULL,
  [物料编号] nvarchar(50) NULL,
  [物料名称] nvarchar(100) NULL,
  [实际添加比例] nvarchar(50) NULL,
  [单支物料含量] nvarchar(50) NULL,
  [设计添加量] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_mold_formula_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_mold_formula_detail', head_table=N'rd_mold_formula_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'MF', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_MOLD_FORMULA';
GO
DELETE FROM yj_field WHERE panel_code='RD_MOLD_FORMULA';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_MOLD_FORMULA' AND col_name=N'产品编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_MOLD_FORMULA', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 120, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_MOLD_FORMULA', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_MOLD_FORMULA', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_MOLD_FORMULA', N'表单管理人', N'表单管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 100, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 80, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'使用范围', N'使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''工艺科/成型车间''),(N''工程技术中心''),(N''银嘉内部''),(N''公司内'')) AS t(v)', NULL, NULL, NULL, N'header', 50, 130, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 1, 0, 1),
('RD_MOLD_FORMULA', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 1, 0, 1),
('RD_MOLD_FORMULA', N'炭棒规格1', N'炭棒规格（1）', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'炭棒规格2', N'炭棒规格（2）', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'炭棒规格3', N'炭棒规格（3）', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'产品管控类型', N'产品管控类型', N'下拉框', N'SELECT v FROM (VALUES (N''·重点管控产品''),(N''·一般管控产品'')) AS t(v)', NULL, NULL, NULL, N'header', 120, 120, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'外观要求', N'外观要求', N'下拉框', N'SELECT v FROM (VALUES (N''·成品''),(N''·半成品'')) AS t(v)', NULL, NULL, NULL, N'header', 130, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'生产车间', N'生产车间', N'下拉框', N'SELECT v FROM (VALUES (N''·4#''),(N''·1#''),(N''·2#''),(N''·3#'')) AS t(v)', NULL, NULL, NULL, N'header', 140, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'配料要求', N'配料要求', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 220, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_MOLD_FORMULA', N'序号', N'No.', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 50, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'物料种类', N'物料种类', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 90, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'物料编号', N'物料编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 110, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 170, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'实际添加比例', N'实际添加\n比例%', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 100, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'单支物料含量', N'单支\n物料含量g', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, 1),
('RD_MOLD_FORMULA', N'设计添加量', N'设计添加\n量', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1);
GO

-- ═══════════════ 3. 组装BOM表 RD_ASM_BOM(plain 清单) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_asm_bom_head') IS NULL CREATE TABLE rd_asm_bom_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_asm_bom_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_asm_bom_detail') IS NULL CREATE TABLE rd_asm_bom_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料名] nvarchar(100) NULL,
  [物料编号] nvarchar(60) NULL,
  [物料规格] nvarchar(500) NULL,
  [外观要求] nvarchar(500) NULL,
  [用量] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_asm_bom_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_asm_bom_detail', head_table=N'rd_asm_bom_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'AB2', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_ASM_BOM';
GO
DELETE FROM yj_field WHERE panel_code='RD_ASM_BOM';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_BOM', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_ASM_BOM', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_ASM_BOM', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_BOM', N'物料名', N'物料名', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 0, 0, 1),
('RD_ASM_BOM', N'物料编号', N'物料编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 1, 0, 0, 1),
('RD_ASM_BOM', N'物料规格', N'物料规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 260, 1, 0, 0, 1),
('RD_ASM_BOM', N'外观要求', N'外观要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 260, 1, 0, 0, 1),
('RD_ASM_BOM', N'用量', N'用量', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 70, 1, 0, 0, 1);
GO

-- ═══════════════ 4. 组装工艺清单 RD_ASM_PROC(plain 清单) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_asm_proc_head') IS NULL CREATE TABLE rd_asm_proc_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_asm_proc_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_asm_proc_detail') IS NULL CREATE TABLE rd_asm_proc_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [工序] nvarchar(60) NULL,
  [工序控制内容] nvarchar(500) NULL,
  [管控要求] nvarchar(1000) NULL,
  [检查比例] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_asm_proc_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_asm_proc_detail', head_table=N'rd_asm_proc_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'AP', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_ASM_PROC';
GO
DELETE FROM yj_field WHERE panel_code='RD_ASM_PROC';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_PROC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_ASM_PROC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_ASM_PROC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_PROC', N'工序', N'工序', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 1, 0, 0, 1),
('RD_ASM_PROC', N'工序控制内容', N'工序控制内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 280, 1, 0, 0, 1),
('RD_ASM_PROC', N'管控要求', N'管控要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 380, 1, 0, 0, 1),
('RD_ASM_PROC', N'检查比例', N'检查比例', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 1, 0, 0, 1);
GO

-- ═══════════════ 5. 规格书 RD_SPEC_DOC(3 表区共用明细:修订/检验/物料) ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_spec_doc_head') IS NULL CREATE TABLE rd_spec_doc_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [名称] nvarchar(200) NULL,
  [编号] nvarchar(50) NULL,
  [客户名] nvarchar(100) NULL,
  [客户料号] nvarchar(60) NULL,
  [版本] nvarchar(30) NULL,
  [日期] nvarchar(30) NULL,
  [制订日期] nvarchar(100) NULL,
  [审核日期] nvarchar(100) NULL,
  [批准日期] nvarchar(100) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_spec_doc_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_spec_doc_detail') IS NULL CREATE TABLE rd_spec_doc_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [表区] nvarchar(20) NULL,
  [序号] nvarchar(20) NULL,
  [更改内容] nvarchar(500) NULL,
  [更改原因] nvarchar(200) NULL,
  [更改时间] nvarchar(50) NULL,
  [责任人] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  [检验项目] nvarchar(100) NULL,
  [检验要求] nvarchar(1000) NULL,
  [检验方法] nvarchar(200) NULL,
  [检验依据] nvarchar(200) NULL,
  [物料编码] nvarchar(60) NULL,
  [物料名称] nvarchar(100) NULL,
  [规格参数] nvarchar(500) NULL,
  [数量] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_spec_doc_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_spec_doc_detail', head_table=N'rd_spec_doc_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'SD', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_SPEC_DOC';
GO
DELETE FROM yj_field WHERE panel_code='RD_SPEC_DOC';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPEC_DOC', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPEC_DOC', N'编号', N'编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 110, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPEC_DOC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_SPEC_DOC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_SPEC_DOC', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 220, 1, 1, 0, 1),
('RD_SPEC_DOC', N'编号', N'编号', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 100, 1, 1, 0, 1),
('RD_SPEC_DOC', N'客户名', N'客户名', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1),
('RD_SPEC_DOC', N'客户料号', N'客户料号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'版本', N'版本', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 90, 1, 0, 0, 1),
('RD_SPEC_DOC', N'日期', N'日期', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('RD_SPEC_DOC', N'制订日期', N'制订/日期', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'审核日期', N'审核/日期', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'批准日期', N'批准/日期', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPEC_DOC', N'表区', N'表区', N'下拉框', N'SELECT v FROM (VALUES (N''修订记录''),(N''检验要求''),(N''物料清单'')) AS t(v)', NULL, NULL, NULL, N'detail', 5, 90, 1, 0, 0, 1),
('RD_SPEC_DOC', N'序号', N'序 号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 60, 1, 0, 0, 1),
('RD_SPEC_DOC', N'更改内容', N'更改内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 220, 1, 0, 0, 1),
('RD_SPEC_DOC', N'更改原因', N'更改原因', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 160, 1, 0, 0, 1),
('RD_SPEC_DOC', N'更改时间', N'更改时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1),
('RD_SPEC_DOC', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 90, 1, 0, 0, 1),
('RD_SPEC_DOC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 1, 0, 0, 1),
('RD_SPEC_DOC', N'检验项目', N'检验项目', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'检验要求', N'检验要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'检验方法', N'检验方法', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'检验依据', N'检验依据', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 1, 0, 0, 1),
('RD_SPEC_DOC', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 130, 1, 0, 0, 1),
('RD_SPEC_DOC', N'规格参数', N'规格参数', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 240, 1, 0, 0, 1),
('RD_SPEC_DOC', N'数量', N'数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 70, 1, 0, 0, 1);
GO

-- ═══════════════ 6. 出货检验计划表 RD_INSP_PLAN ═══════════════
BEGIN TRY
IF OBJECT_ID('rd_insp_plan_head') IS NULL CREATE TABLE rd_insp_plan_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_insp_docno DEFAULT N'YJ-RD001',
  [标题] nvarchar(200) NULL,
  [版本号] nvarchar(30) NULL,
  [密级] nvarchar(20) NULL,
  [产品编号] nvarchar(50) NULL,
  [客户名] nvarchar(100) NULL,
  [管理人] nvarchar(50) NULL,
  [主要性能] nvarchar(100) NULL,
  [滤芯尺寸] nvarchar(100) NULL,
  [授权使用人] nvarchar(200) NULL,
  [编写人] nvarchar(50) NULL,
  [审核人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_insp_plan_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_insp_plan_detail') IS NULL CREATE TABLE rd_insp_plan_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [控制项目] nvarchar(100) NULL,
  [质量控制内容] nvarchar(200) NULL,
  [检测仪器] nvarchar(100) NULL,
  [控制标准及要求] nvarchar(2000) NULL,
  [检验] nvarchar(30) NULL,
  [不合格应对措施] nvarchar(1000) NULL,
  [检测频率] nvarchar(100) NULL,
  [取样方式] nvarchar(100) NULL,
  [检验内容] nvarchar(200) NULL,
  [控制方法] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_insp_plan_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_insp_plan_detail', head_table=N'rd_insp_plan_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'IP', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_INSP_PLAN';
GO
DELETE FROM yj_field WHERE panel_code='RD_INSP_PLAN';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_INSP_PLAN' AND col_name=N'标题' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_INSP_PLAN', N'标题', N'标题', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 220, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_INSP_PLAN' AND col_name=N'产品编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_INSP_PLAN', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 110, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_INSP_PLAN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_INSP_PLAN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_INSP_PLAN', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 110, 1, 0, 1, 1),
('RD_INSP_PLAN', N'标题', N'标题', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 220, 1, 1, 0, 1),
('RD_INSP_PLAN', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 90, 1, 0, 0, 1),
('RD_INSP_PLAN', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 60, 80, 1, 0, 0, 1),
('RD_INSP_PLAN', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 0, 0, 1),
('RD_INSP_PLAN', N'客户名', N'客户名', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('RD_INSP_PLAN', N'管理人', N'管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 90, 1, 0, 0, 1),
('RD_INSP_PLAN', N'主要性能', N'主要性能', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 110, 1, 0, 0, 1),
('RD_INSP_PLAN', N'滤芯尺寸', N'滤芯尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 160, 1, 0, 0, 1),
('RD_INSP_PLAN', N'授权使用人', N'授权使用人', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 0, 1),
('RD_INSP_PLAN', N'编写人', N'编写人', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 90, 1, 0, 0, 1),
('RD_INSP_PLAN', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 90, 1, 0, 0, 1),
('RD_INSP_PLAN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_INSP_PLAN', N'控制项目', N'控制项目', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 110, 1, 0, 0, 1),
('RD_INSP_PLAN', N'质量控制内容', N'质量控制内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 130, 1, 0, 0, 1),
('RD_INSP_PLAN', N'检测仪器', N'检测仪器、工具', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 1, 0, 0, 1),
('RD_INSP_PLAN', N'控制标准及要求', N'控制标准及要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 320, 1, 0, 0, 1),
('RD_INSP_PLAN', N'检验', N'检验', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 70, 1, 0, 0, 1),
('RD_INSP_PLAN', N'不合格应对措施', N'不合格应对措施', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 280, 1, 0, 0, 1),
('RD_INSP_PLAN', N'检测频率', N'检测频率', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 1, 0, 0, 1),
('RD_INSP_PLAN', N'取样方式', N'取样方式', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 0, 1),
('RD_INSP_PLAN', N'检验内容', N'检验内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 180, 1, 0, 0, 1),
('RD_INSP_PLAN', N'控制方法', N'控制方法', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 0, 0, 1);
GO

-- ═══════════════ 权限 ═══════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_proc_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_formula_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_formula_detail TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_bom_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_bom_detail TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_proc_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_proc_detail TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spec_doc_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spec_doc_detail TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_insp_plan_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_insp_plan_detail TO yinjia;
GO

-- ═══════════════ 字段译名(en;已有跳过) ═══════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'表单管理人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'表单管理人', 'en', N'Form Keeper', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'使用范围' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'使用范围', 'en', N'Usage Scope', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'版本号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'版本号', 'en', N'Version', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品编号', 'en', N'Product No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品名称', 'en', N'Product Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒规格（1）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒规格（1）', 'en', N'Rod Spec (1)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒规格（2）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒规格（2）', 'en', N'Rod Spec (2)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'炭棒规格（3）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'炭棒规格（3）', 'en', N'Rod Spec (3)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品管控类型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品管控类型', 'en', N'Control Class', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'理论最低灌料重量g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'理论最低灌料重量g', 'en', N'Min Filling (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'理论灌料中间值g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'理论灌料中间值g', 'en', N'Mid Filling (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'理论最高灌料重量g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'理论最高灌料重量g', 'en', N'Max Filling (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际灌料重量计算公式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际灌料重量计算公式', 'en', N'Actual Filling Formula', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'烧结时间/调速器参数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'烧结时间/调速器参数', 'en', N'Sinter Time / Speed', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最短长度mm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最短长度mm', 'en', N'Min Length (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最长长度mm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最长长度mm', 'en', N'Max Length (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最低重量g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最低重量g', 'en', N'Min Weight (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最高重量g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'最高重量g', 'en', N'Max Weight (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外径mm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外径mm', 'en', N'OD (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外径公差' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外径公差', 'en', N'OD Tol.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'内径mm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'内径mm', 'en', N'ID (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'内径公差' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'内径公差', 'en', N'ID Tol.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'内孔要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'内孔要求', 'en', N'Bore Req.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'密度管控要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'密度管控要求', 'en', N'Density Req.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际密度管控下限' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际密度管控下限', 'en', N'Density Lower', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际密度管控上限' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际密度管控上限', 'en', N'Density Upper', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'高度cm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'高度cm', 'en', N'Height (cm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'跌落次数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'跌落次数', 'en', N'Drops', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试间距mm' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试间距mm', 'en', N'Test Span (mm)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'压头下降速度mm/min' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'压头下降速度mm/min', 'en', N'Press Speed (mm/min)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'强度要求kgf' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'强度要求kgf', 'en', N'Strength (kgf)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试管路' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试管路', 'en', N'Test Line', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试流速L/min' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试流速L/min', 'en', N'Flow (L/min)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'压降标准kpa' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'压降标准kpa', 'en', N'ΔP Limit (kPa)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'配料要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'配料要求', 'en', N'Batching Req.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料种类' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料种类', 'en', N'Material Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料编号', 'en', N'Material No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料名称', 'en', N'Material Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实际添加\n比例%' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实际添加\n比例%', 'en', N'Actual %', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单支\n物料含量g' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单支\n物料含量g', 'en', N'Per-pc (g)', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'设计添加\n量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'设计添加\n量', 'en', N'Design Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料名' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料名', 'en', N'Material', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料规格' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料规格', 'en', N'Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'工序', 'en', N'Process', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序控制内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'工序控制内容', 'en', N'Control Content', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检查比例' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检查比例', 'en', N'Check %', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'名称', 'en', N'Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'编号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'编号', 'en', N'No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户料号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户料号', 'en', N'Customer P/N', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'版本' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'版本', 'en', N'Version', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'制订/日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'制订/日期', 'en', 'Prepared / Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核/日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核/日期', 'en', N'Reviewed / Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批准/日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批准/日期', 'en', N'Approved / Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'表区' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'表区', 'en', N'Section', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'更改内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'更改内容', 'en', N'Change', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'更改原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'更改原因', 'en', N'Reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'更改时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'更改时间', 'en', N'Changed At', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'责任人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'责任人', 'en', N'Owner', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验项目' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验项目', 'en', N'Inspection Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验要求', 'en', N'Requirement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验方法' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验方法', 'en', N'Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验依据' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验依据', 'en', N'Basis', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料编码', 'en', N'Material Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'规格参数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'规格参数', 'en', N'Spec Params', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'标题' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'标题', 'en', N'Title', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'管理人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'管理人', 'en', N'Keeper', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'主要性能' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'主要性能', 'en', N'Main Performance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'滤芯尺寸' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'滤芯尺寸', 'en', N'Filter Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'授权使用人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'授权使用人', 'en', N'Authorized Users', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'编写人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'编写人', 'en', N'Writer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人', 'en', N'Reviewer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'控制项目' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'控制项目', 'en', N'Control Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'质量控制内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'质量控制内容', 'en', N'QC Content', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测仪器、工具' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测仪器、工具', 'en', N'Instrument / Tool', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'控制标准及要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'控制标准及要求', 'en', N'Standard & Requirement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不合格应对措施' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不合格应对措施', 'en', N'Non-conformance Action', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测频率' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测频率', 'en', N'Frequency', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'取样方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'取样方式', 'en', N'Sampling', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验内容', 'en', N'Inspection Content', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'控制方法' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'控制方法', 'en', N'Control Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料清单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料清单', 'en', N'Material List', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修订记录' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修订记录', 'en', N'Revisions', 'manual');
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('RD_MOLD_PROC','RD_MOLD_FORMULA','RD_ASM_BOM','RD_ASM_PROC','RD_SPEC_DOC','RD_INSP_PLAN'));
PRINT N'产品文件 6 面板字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
-- 文书面板数据键 = yj_field.label,必须与前端配置键(col_name)一致;显示文案由配置 label 承担
UPDATE yj_field SET label = col_name WHERE panel_code IN ('RD_MOLD_PROC','RD_MOLD_FORMULA','RD_ASM_BOM','RD_ASM_PROC','RD_SPEC_DOC','RD_INSP_PLAN');
PRINT N'字段标签已对齐列名(数据键一致性)';
GO
