SET NOCOUNT ON;
PRINT '=== 1. 证据:0009 的产品名称应 = TEXT-ONLY-0 ===';
SELECT id, 单据编号, 产品名称, 单据状态 FROM qc_tc_in WHERE 单据编号='TCI-2026-09-0009';
GO
PRINT '=== 2. 清理前计数(全是我本次造的) ===';
SELECT (SELECT COUNT(*) FROM qc_tc_in) AS qc_tc_in行数,
       (SELECT COUNT(*) FROM s_allno WHERE lb='TCI') AS s_allno行数,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='QC_TC_IN') AS doc_status行数,
       (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='QC_TC_IN') AS form_approval行数;
GO
PRINT '=== 3. 清理 ===';
DELETE FROM qc_tc_in WHERE 单据编号 LIKE 'TCI-2026-09-%';
DELETE FROM s_allno WHERE lb='TCI';
DELETE FROM yj_doc_status WHERE panel_code='QC_TC_IN';
DELETE FROM yj_form_approval WHERE panel_code='QC_TC_IN';
GO
PRINT '=== 4. 清理后(应全 0) ===';
SELECT (SELECT COUNT(*) FROM qc_tc_in) AS qc_tc_in行数,
       (SELECT COUNT(*) FROM s_allno WHERE lb='TCI') AS s_allno行数,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='QC_TC_IN') AS doc_status行数,
       (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='QC_TC_IN') AS form_approval行数;
GO
