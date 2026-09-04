-- migrate-rd-prod2.sql — 产品文件升级:产品信息表(14字段新面板)/组装BOM重构(基本信息+修订+物料)/检验计划分组/工艺下拉
SET NOCOUNT ON;
GO

-- ═══ 1. 产品信息表 RD_PROD_INFO(14 字段纯表单) ═══
BEGIN TRY
IF OBJECT_ID('rd_prod_info_head') IS NULL CREATE TABLE rd_prod_info_head (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [产品编号] nvarchar(60) NULL,
  [产品名称] nvarchar(200) NULL,
  [产品类别] nvarchar(100) NULL,
  [产品类型] nvarchar(50) NULL,
  [产品整体尺寸] nvarchar(100) NULL,
  [客户料号] nvarchar(60) NULL,
  [炭棒尺寸] nvarchar(100) NULL,
  [特殊性能描述] nvarchar(1000) NULL,
  [下单数量] nvarchar(50) NULL,
  [产品分类] nvarchar(50) NULL,
  [产品形态] nvarchar(200) NULL,
  [客户图纸或规格书] nvarchar(500) NULL,
  [责任人] nvarchar(50) NULL,
  [审核人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_prod_info_head 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
-- 纯表单占位明细表(防空明细软删误伤头行)
BEGIN TRY
IF OBJECT_ID('rd_prod_info_detail') IS NULL CREATE TABLE rd_prod_info_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_prod_info_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
UPDATE yj_panel SET mode=N'doc', line_table=N'rd_prod_info_detail', head_table=N'rd_prod_info_head', group_col=N'单据编号', pk_col=N'id', code_col=N'单据编号', prefix=N'PI', date_col=N'单据日期', page_size=20, detail_key=N'items', module_group=N'研发管理' WHERE panel_code='RD_PROD_INFO';
GO
DELETE FROM yj_field WHERE panel_code='RD_PROD_INFO';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'产品编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROD_INFO', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'产品名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROD_INFO', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 180, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_PROD_INFO', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_PROD_INFO', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_PROD_INFO', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 130, 1, 1, 0, 1),
('RD_PROD_INFO', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 200, 1, 1, 0, 1),
('RD_PROD_INFO', N'产品类别', N'产品类别', N'下拉框', N'SELECT v FROM (VALUES (N''阻垢''),(N''除铅''),(N''除余氯''),(N''VOC''),(N''抑菌''),(N''矿化''),(N''碱性'')) AS t(v)', NULL, NULL, NULL, N'header', 50, 110, 1, 1, 0, 1),
('RD_PROD_INFO', N'产品类型', N'产品类型', N'下拉框', N'SELECT v FROM (VALUES (N''成品''),(N''半成品''),(N''裸棒'')) AS t(v)', NULL, NULL, NULL, N'header', 60, 100, 1, 1, 0, 1),
('RD_PROD_INFO', N'产品整体尺寸', N'产品整体尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 180, 1, 0, 0, 1),
('RD_PROD_INFO', N'客户料号', N'客户料号', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 110, 1, 0, 0, 1),
('RD_PROD_INFO', N'炭棒尺寸', N'炭棒尺寸', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 180, 1, 0, 0, 1),
('RD_PROD_INFO', N'特殊性能描述', N'特殊性能描述', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 200, 1, 0, 0, 1),
('RD_PROD_INFO', N'下单数量', N'下单数量', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 100, 1, 0, 0, 1),
('RD_PROD_INFO', N'产品分类', N'产品分类', N'下拉框', N'SELECT v FROM (VALUES (N''重点产品''),(N''KPC产品''),(N''其他'')) AS t(v)', NULL, NULL, NULL, N'header', 120, 110, 1, 0, 0, 1),
('RD_PROD_INFO', N'产品形态', N'产品形态', N'下拉框', N'SELECT v FROM (VALUES (N''包布''),(N''套网''),(N''打端盖''),(N''套PP棉'')) AS t(v)', NULL, NULL, NULL, N'header', 130, 120, 1, 0, 0, 1),
('RD_PROD_INFO', N'客户图纸或规格书', N'客户图纸或规格书', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 180, 1, 0, 0, 1),
('RD_PROD_INFO', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 100, 1, 0, 0, 1),
('RD_PROD_INFO', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 100, 1, 0, 0, 1),
('RD_PROD_INFO', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 160, 1, 0, 0, 1);
GO

-- ═══ 2. 组装BOM重构:头表加产品字段;明细加修订表区列 ═══
BEGIN TRY
IF COL_LENGTH('rd_asm_bom_head', '产品编号') IS NULL ALTER TABLE rd_asm_bom_head ADD [产品编号] nvarchar(60) NULL;
IF COL_LENGTH('rd_asm_bom_head', '产品名称') IS NULL ALTER TABLE rd_asm_bom_head ADD [产品名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_asm_bom_head', '产品种类') IS NULL ALTER TABLE rd_asm_bom_head ADD [产品种类] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_bom_head', '整体规格外径') IS NULL ALTER TABLE rd_asm_bom_head ADD [整体规格外径] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_bom_head', '整体规格长度') IS NULL ALTER TABLE rd_asm_bom_head ADD [整体规格长度] nvarchar(100) NULL;
IF COL_LENGTH('rd_asm_bom_head', '成品重量') IS NULL ALTER TABLE rd_asm_bom_head ADD [成品重量] nvarchar(50) NULL;
END TRY
BEGIN CATCH
  PRINT 'rd_asm_bom_head 加列跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF COL_LENGTH('rd_asm_bom_detail', '表区') IS NULL ALTER TABLE rd_asm_bom_detail ADD [表区] nvarchar(20) NULL;
IF COL_LENGTH('rd_asm_bom_detail', '序号') IS NULL ALTER TABLE rd_asm_bom_detail ADD [序号] nvarchar(20) NULL;
IF COL_LENGTH('rd_asm_bom_detail', '更改内容') IS NULL ALTER TABLE rd_asm_bom_detail ADD [更改内容] nvarchar(500) NULL;
IF COL_LENGTH('rd_asm_bom_detail', '更改原因') IS NULL ALTER TABLE rd_asm_bom_detail ADD [更改原因] nvarchar(200) NULL;
IF COL_LENGTH('rd_asm_bom_detail', '更改时间') IS NULL ALTER TABLE rd_asm_bom_detail ADD [更改时间] nvarchar(50) NULL;
IF COL_LENGTH('rd_asm_bom_detail', '责任人') IS NULL ALTER TABLE rd_asm_bom_detail ADD [责任人] nvarchar(50) NULL;
END TRY
BEGIN CATCH
  PRINT 'rd_asm_bom_detail 加列跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
DELETE FROM yj_field WHERE panel_code='RD_ASM_BOM';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_ASM_BOM' AND col_name=N'产品编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_ASM_BOM', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 130, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_BOM', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_ASM_BOM', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_ASM_BOM', N'产品编号', N'产品编号', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 130, 1, 1, 0, 1),
('RD_ASM_BOM', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 200, 1, 1, 0, 1),
('RD_ASM_BOM', N'产品种类', N'产品种类', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 130, 1, 0, 0, 1),
('RD_ASM_BOM', N'整体规格外径', N'整体规格（外径）', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 150, 1, 0, 0, 1),
('RD_ASM_BOM', N'整体规格长度', N'整体规格（长度）', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 150, 1, 0, 0, 1),
('RD_ASM_BOM', N'成品重量', N'成品重量', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 110, 1, 0, 0, 1),
('RD_ASM_BOM', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_ASM_BOM', N'表区', N'表区', N'下拉框', N'SELECT v FROM (VALUES (N''修订记录''),(N''物料清单'')) AS t(v)', NULL, NULL, NULL, N'detail', 5, 90, 1, 0, 0, 1),
('RD_ASM_BOM', N'序号', N'序号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 60, 1, 0, 0, 1),
('RD_ASM_BOM', N'更改内容', N'更改内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 200, 1, 0, 0, 1),
('RD_ASM_BOM', N'更改原因', N'更改原因', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, 1),
('RD_ASM_BOM', N'更改时间', N'更改时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1),
('RD_ASM_BOM', N'责任人', N'责任人', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 90, 1, 0, 0, 1),
('RD_ASM_BOM', N'物料名', N'物料名', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 140, 1, 0, 0, 1),
('RD_ASM_BOM', N'物料编号', N'物料编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 1, 0, 0, 1),
('RD_ASM_BOM', N'物料规格', N'物料规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 260, 1, 0, 0, 1),
('RD_ASM_BOM', N'外观要求', N'外观要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 260, 1, 0, 0, 1),
('RD_ASM_BOM', N'用量', N'用量', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 80, 1, 0, 0, 1);
GO

-- ═══ 3. 出货检验计划:明细加 检验类别(必测项/型式检验) ═══
BEGIN TRY
IF COL_LENGTH('rd_insp_plan_detail', '检验类别') IS NULL ALTER TABLE rd_insp_plan_detail ADD [检验类别] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT 'rd_insp_plan_detail 加列跳过';
END CATCH
GO
DELETE FROM yj_field WHERE panel_code='RD_INSP_PLAN' AND col_name=N'检验类别';
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_INSP_PLAN', N'检验类别', N'检验类别', N'下拉框', N'SELECT v FROM (VALUES (N''必测项''),(N''型式检验'')) AS t(v)', NULL, NULL, NULL, N'detail', 5, 90, 1, 0, 0, 1);
GO

-- ═══ 4. 成型工艺:烧结炉参数/烧结时间调速器参数/冷却参数设置 改下拉(选项来自烧结尺寸表) ═══
UPDATE yj_field SET data_type=N'下拉框', dict_sql=N'SELECT v FROM (VALUES (N''170度''),(N''180度''),(N''185度''),(N''190度''),(N''200度'')) AS t(v)' WHERE panel_code='RD_MOLD_PROC' AND col_name=N'烧结炉参数';
UPDATE yj_field SET data_type=N'下拉框', dict_sql=N'SELECT v FROM (VALUES (N''40分钟''),(N''55分钟''),(N''60分钟''),(N''65分钟''),(N''80分钟''),(N''125分钟'')) AS t(v)' WHERE panel_code='RD_MOLD_PROC' AND col_name=N'烧结时间调速器参数';
UPDATE yj_field SET data_type=N'下拉框', dict_sql=N'SELECT v FROM (VALUES (N''打开全部冷却风扇''),(N''关闭全部冷却风扇''),(N''冷却调速设置3.7~4.3，打开全部冷却风扇''),(N''冷却调速设置12，关闭全部冷却风扇''),(N''冷却调速设置35-45，打开冷却线入口及出口冷却风扇'')) AS t(v)' WHERE panel_code='RD_MOLD_PROC' AND col_name=N'冷却参数设置';
GO
-- 规格书种类字典补 迈博瑞复合滤芯
UPDATE yj_field SET dict_sql=N'SELECT v FROM (VALUES (N''飞利浦沐浴阻垢滤芯''),(N''矿化烧结炭棒''),(N''迈博瑞复合滤芯''),(N''除铅炭棒''),(N''抑菌炭棒''),(N''X14折叠复合滤芯''),(N''碱性炭棒''),(N''矿化炭棒''),(N''多功能炭棒'')) AS t(v)' WHERE panel_code='RD_SPEC_DOC' AND col_name=N'规格书种类';
GO

-- ═══ 权限 ═══
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_prod_info_head TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_prod_info_detail TO yinjia;
GO

-- ═══ 译名(en;已有跳过) ═══
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品类别' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品类别', 'en', N'Product Category', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品类型' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品类型', 'en', N'Product Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品整体尺寸' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品整体尺寸', 'en', N'Overall Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特殊性能描述' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特殊性能描述', 'en', N'Special Performance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'下单数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'下单数量', 'en', N'Order Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品分类' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品分类', 'en', N'Classification', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品形态' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品形态', 'en', N'Form', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户图纸或规格书' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户图纸或规格书', 'en', N'Customer Drawing / Spec', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品种类' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品种类', 'en', N'Product Kind', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整体规格（外径）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整体规格（外径）', 'en', N'Overall OD', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整体规格（长度）' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整体规格（长度）', 'en', N'Overall Length', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成品重量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成品重量', 'en', N'Finished Weight', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验类别' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验类别', 'en', N'Inspection Class', 'manual');
GO

PRINT N'产品文件升级迁移完成';
GO
