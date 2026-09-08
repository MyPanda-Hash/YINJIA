-- migrate-rd-spec-multi.sql — 规格书升级:8 种类型 + 章节字段 + 多页结构(单面板/类型Tab/页签分页)
SET NOCOUNT ON;
GO
BEGIN TRY
IF COL_LENGTH('rd_spec_doc_head', '规格书种类') IS NULL ALTER TABLE rd_spec_doc_head ADD [规格书种类] nvarchar(60) NULL;
IF COL_LENGTH('rd_spec_doc_head', '适用范围') IS NULL ALTER TABLE rd_spec_doc_head ADD [适用范围] nvarchar(1000) NULL;
IF COL_LENGTH('rd_spec_doc_head', '整体规格参数') IS NULL ALTER TABLE rd_spec_doc_head ADD [整体规格参数] nvarchar(1000) NULL;
IF COL_LENGTH('rd_spec_doc_head', '产品主要性能') IS NULL ALTER TABLE rd_spec_doc_head ADD [产品主要性能] nvarchar(500) NULL;
IF COL_LENGTH('rd_spec_doc_head', '包装方式') IS NULL ALTER TABLE rd_spec_doc_head ADD [包装方式] nvarchar(1000) NULL;
IF COL_LENGTH('rd_spec_doc_head', '运输要求') IS NULL ALTER TABLE rd_spec_doc_head ADD [运输要求] nvarchar(1000) NULL;
IF COL_LENGTH('rd_spec_doc_head', '存储环境') IS NULL ALTER TABLE rd_spec_doc_head ADD [存储环境] nvarchar(1000) NULL;
END TRY
BEGIN CATCH
  PRINT 'rd_spec_doc_head 加列跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
-- 字段重建(label=col_name 数据键一致);新增 规格书种类(查询+表头) 与章节字段
DELETE FROM yj_field WHERE panel_code='RD_SPEC_DOC';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'规格书种类' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPEC_DOC', N'规格书种类', N'规格书种类', N'下拉框', N'SELECT v FROM (VALUES (N''飞利浦沐浴阻垢滤芯''),(N''矿化烧结炭棒''),(N''除铅炭棒''),(N''抑菌炭棒''),(N''X14折叠复合滤芯''),(N''碱性炭棒''),(N''矿化炭棒''),(N''多功能炭棒'')) AS t(v)', NULL, NULL, NULL, N'query', 10, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPEC_DOC', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND col_name=N'编号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_SPEC_DOC', N'编号', N'编号', N'文本', NULL, NULL, NULL, NULL, N'query', 30, 110, 0, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPEC_DOC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
('RD_SPEC_DOC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
('RD_SPEC_DOC', N'规格书种类', N'规格书种类', N'下拉框', N'SELECT v FROM (VALUES (N''飞利浦沐浴阻垢滤芯''),(N''矿化烧结炭棒''),(N''除铅炭棒''),(N''抑菌炭棒''),(N''X14折叠复合滤芯''),(N''碱性炭棒''),(N''矿化炭棒''),(N''多功能炭棒'')) AS t(v)', NULL, NULL, NULL, N'header', 30, 160, 1, 1, 0, 1),
('RD_SPEC_DOC', N'名称', N'名称', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 220, 1, 1, 0, 1),
('RD_SPEC_DOC', N'编号', N'编号', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 1, 0, 1),
('RD_SPEC_DOC', N'客户名', N'客户名', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1),
('RD_SPEC_DOC', N'客户料号', N'客户料号', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'版本', N'版本', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 90, 1, 0, 0, 1),
('RD_SPEC_DOC', N'日期', N'日期', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 100, 1, 0, 0, 1),
('RD_SPEC_DOC', N'制订日期', N'制订日期', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'审核日期', N'审核日期', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'批准日期', N'批准日期', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 110, 1, 0, 0, 1),
('RD_SPEC_DOC', N'适用范围', N'适用范围', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'整体规格参数', N'整体规格参数', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'产品主要性能', N'产品主要性能', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 220, 1, 0, 0, 1),
('RD_SPEC_DOC', N'包装方式', N'包装方式', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'运输要求', N'运输要求', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'存储环境', N'存储环境', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 260, 1, 0, 0, 1),
('RD_SPEC_DOC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 160, 1, 0, 0, 1);
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('RD_SPEC_DOC', N'表区', N'表区', N'下拉框', N'SELECT v FROM (VALUES (N''修订记录''),(N''检验要求''),(N''物料清单'')) AS t(v)', NULL, NULL, NULL, N'detail', 5, 90, 1, 0, 0, 1),
('RD_SPEC_DOC', N'序号', N'序号', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 60, 1, 0, 0, 1),
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
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'规格书种类' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'规格书种类', 'en', N'Spec Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'适用范围' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'适用范围', 'en', N'Scope', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'整体规格参数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'整体规格参数', 'en', N'Overall Specs', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品主要性能' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品主要性能', 'en', N'Main Performance', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'包装方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'包装方式', 'en', N'Packaging', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'运输要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'运输要求', 'en', N'Transport Req.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存储环境' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存储环境', 'en', N'Storage Env.', 'manual');
GO
PRINT N'规格书多类型多页升级完成';
GO
