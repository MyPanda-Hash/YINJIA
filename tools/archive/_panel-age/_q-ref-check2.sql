SET NOCOUNT ON;
SELECT 'USAGE_LOG' AS k, panel_name, COUNT(*) AS n FROM yj_usage_log
WHERE panel_name IN (N'请购单',N'其他入库单',N'其他入库单明细表',N'其他入库单统计表',N'其他出库单',N'其他出库单明细表',N'其他出库单统计表',N'委外入库单',N'委外入库单明细表',N'委外入库单统计表',N'委外发料单',N'委外发料单明细表',N'委外发料单统计表')
GROUP BY panel_name;
GO
SELECT 'ATTACH' AS k, COUNT(*) AS n FROM yj_attachment WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'APPROVAL' AS k, COUNT(*) AS n FROM yj_form_approval WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'REPORT_COL_SETTINGS' AS k, COUNT(*) AS n FROM report_column_settings WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'MODIFY_LOG' AS k, COUNT(*) AS n FROM yj_doc_modify_log WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'ARCHIVE_LOG' AS k, COUNT(*) AS n FROM yj_archive_change_log WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'PLAN_TERM' AS k, COUNT(*) AS n FROM yj_plan_term WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
GO
SELECT 'EXT_BIND' AS k, COUNT(*) AS n FROM yj_ext_bind_log WHERE panel_code IN ('PU_REQ','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE');
