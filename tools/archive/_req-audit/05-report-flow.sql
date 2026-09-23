SET NOCOUNT ON;
PRINT '=== 1. 含 report 的表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%report%' OR TABLE_NAME LIKE '%template%';
GO
PRINT '=== 2. 已注册报表模板 ===';
SELECT * FROM yj_report_template;
GO
PRINT '=== 3. yj_doc_status 结构与用量 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
GO
SELECT TOP 25 panel_code, status, COUNT(*) AS cnt FROM yj_doc_status GROUP BY panel_code, status ORDER BY panel_code, status;
GO
PRINT '=== 4. 单据状态可选值(面板字段 dict) ===';
SELECT panel_code, label, dict_sql FROM yj_field WHERE label IN (N'单据状态', N'状态') AND dict_sql IS NOT NULL ORDER BY panel_code;
GO
PRINT '=== 5. 面板 config 里带按钮配置的(取样) ===';
SELECT TOP 12 panel_code, LEFT(CONVERT(NVARCHAR(MAX), config), 900) AS cfg FROM yj_panel WHERE config IS NOT NULL AND panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','RD_PROD_INFO','RD_SPEC_DOC','RD_PLAN','PU_ORDER','OTHER_IN','OTHER_OUT');
GO
PRINT '=== 6. 翻译覆盖:面板/字段译名条数(按 locale) ===';
SELECT locale, COUNT(*) AS cnt FROM yj_translation GROUP BY locale ORDER BY cnt DESC;
GO
PRINT '=== 7. 研发面板的译名缺失(无 en 译名的面板) ===';
SELECT p.panel_code, p.panel_name FROM yj_panel p WHERE p.module_group=N'研发管理'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
GO
PRINT '=== 8. 品质/供应链面板无 en 译名 ===';
SELECT p.panel_code, p.panel_name FROM yj_panel p WHERE p.module_group IN (N'智能供应链',N'品质管理',N'库存核算',N'仓库管理',N'采购管理')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
