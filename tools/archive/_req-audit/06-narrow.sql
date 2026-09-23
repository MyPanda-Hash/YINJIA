SET NOCOUNT ON;
PRINT '=== 1. yj_report_template 结构 ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_report_template' ORDER BY ORDINAL_POSITION;
GO
PRINT '=== 2. 模板清单(不含 XML) ===';
SELECT id, template_code, panel_code, name, enabled, remark, create_at FROM yj_report_template;
GO
PRINT '=== 3. yj_doc_status 结构 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
GO
PRINT '=== 4. yj_doc_status 按面板统计 ===';
SELECT TOP 40 panel_code, COUNT(*) AS cnt, SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) AS audited, SUM(CASE WHEN canceled='Y' THEN 1 ELSE 0 END) AS canceled_cnt, SUM(CASE WHEN saved='Y' THEN 1 ELSE 0 END) AS saved_cnt, SUM(CASE WHEN modify_state IS NOT NULL THEN 1 ELSE 0 END) AS modify_cnt FROM yj_doc_status GROUP BY panel_code ORDER BY panel_code;
GO
PRINT '=== 5. modify_state 取值样例 ===';
SELECT DISTINCT modify_state FROM yj_doc_status WHERE modify_state IS NOT NULL;
GO
PRINT '=== 6. 单据状态/状态 下拉选项 ===';
SELECT panel_code, label, dict_sql FROM yj_field WHERE label IN (N'单据状态', N'状态') AND dict_sql IS NOT NULL ORDER BY panel_code;
GO
PRINT '=== 6b. 单据状态来源:是否由 yj_doc_status 派生 ===';
SELECT TOP 10 panel_code, doc_no, shr, shsj, canceled, saved, modify_state, archived, stopped FROM yj_doc_status ORDER BY id DESC;
GO
PRINT '=== 7. 翻译按 locale ===';
SELECT locale, COUNT(*) AS cnt FROM yj_translation GROUP BY locale ORDER BY cnt DESC;
GO
PRINT '=== 8. 研发面板缺 en 译名 ===';
SELECT p.panel_code, p.panel_name FROM yj_panel p WHERE p.module_group=N'研发管理'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
GO
PRINT '=== 9. 供应链/品质/库存面板缺 en 译名 ===';
SELECT p.panel_code, p.panel_name, p.module_group FROM yj_panel p WHERE p.module_group IN (N'智能供应链',N'品质管理',N'库存核算',N'仓库管理',N'采购管理')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
GO
PRINT '=== 10. 面板 config 样例(截断 400 字符) ===';
SELECT panel_code, LEFT(CONVERT(NVARCHAR(MAX), config), 400) AS cfg FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','RD_PROD_INFO','RD_SPEC_DOC','RD_PLAN','PU_ORDER');
