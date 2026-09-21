SET NOCOUNT ON;
PRINT N'=== C8:特采申请单面板与字段 ===';
SELECT TOP 40 f.panel_code, p.panel_name, f.col_name, f.label, f.place, f.editable, f.visible, f.ref_panel
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.panel_name LIKE N'%特采%' OR f.panel_code = 'QC_TC'
ORDER BY f.panel_code, f.place, f.seq;
GO
PRINT N'=== 全库列名含 特采 ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE N'%特采%';
GO
PRINT N'=== yj_field 含 特采 ===';
SELECT panel_code, col_name, label, dict_sql FROM yj_field WHERE col_name LIKE N'%特采%' OR label LIKE N'%特采%';
GO
PRINT N'=== 单据数据量:采购链 ===';
SELECT 'PU_ORDER' AS 面板, COUNT(*) AS 单数 FROM bd_pu_order
UNION ALL SELECT 'QC_RECV(bd)', COUNT(*) FROM sl_recv
UNION ALL SELECT 'QC_RECV(bl)', COUNT(*) FROM sl_recv_detail
UNION ALL SELECT 'QC_INSP(bd)', COUNT(*) FROM qc_insp
UNION ALL SELECT 'QC_INSP(bl)', COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'QC_RETURN', COUNT(*) FROM qc_return
UNION ALL SELECT 'PURCHASE_IN(bd)', COUNT(*) FROM bd_purchase_in
UNION ALL SELECT 'QC_TC(头)', COUNT(*) FROM qc_tc
UNION ALL SELECT 'QC_TC(行)', COUNT(*) FROM qc_tc_detail
UNION ALL SELECT 'OTHER_IN(头)', COUNT(*) FROM bd_other_in
UNION ALL SELECT 'OTHER_OUT(头)', COUNT(*) FROM bd_other_out;
GO
