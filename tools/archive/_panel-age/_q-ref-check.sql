SET NOCOUNT ON;
-- _q-ref-check.sql — 别的面板有没有「参照」到要下架的面板;批号表/使用日志有没有它们的痕迹
DECLARE @names TABLE (n nvarchar(200));
INSERT INTO @names(n) VALUES (N'请购单'),(N'其他入库单'),(N'其他入库单明细表'),(N'其他入库单统计表'),
 (N'其他出库单'),(N'其他出库单明细表'),(N'其他出库单统计表'),(N'委外入库单'),(N'委外入库单明细表'),
 (N'委外入库单统计表'),(N'委外发料单'),(N'委外发料单明细表'),(N'委外发料单统计表');
SELECT 'FIELD_REF_PANEL' AS k, f.panel_code, f.label, f.ref_panel FROM yj_field f
WHERE f.ref_panel IN ('PU_REQ','OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL',
 'OTHER_OUT_STATS','OUTSOURCE_IN','OUTSOURCE_IN_DETAIL','OUTSOURCE_IN_STATS','OUTSOURCE_ISSUE','OUTSOURCE_ISSUE_DETAIL','OUTSOURCE_ISSUE_STATS');
GO
SELECT 'DOC_BATCH' AS k, COUNT(*) AS n FROM yj_doc_batch
WHERE source_panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE')
   OR target_panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'USAGE_LOG' AS k, panel_name, COUNT(*) AS n FROM yj_usage_log
WHERE panel_name IN (SELECT n FROM @names) GROUP BY panel_name;
GO
SELECT 'ATTACH' AS k, COUNT(*) AS n FROM yj_attachment WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'APPROVAL' AS k, COUNT(*) AS n FROM yj_form_approval WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'REPORT_COL_SETTINGS' AS k, COUNT(*) AS n FROM report_column_settings WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
