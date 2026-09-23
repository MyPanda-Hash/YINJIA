-- r-08:补充取证(PU_ORDER 表头 / 测试记录面板 / 检验模板 / 特采 / 附件与报表设置行数)
SET NOCOUNT ON;
GO
PRINT '=== [1] PU_ORDER 表头字段(报表参数来源) ===';
SELECT col_name, label, data_type, place, visible, hidden
FROM yj_field WHERE panel_code='PU_ORDER' AND place LIKE '%header%' ORDER BY seq;
GO
PRINT '=== [2] PU_ORDER 行字段里含价格/数量的列(判断「含单价版/不含单价版」差异面) ===';
SELECT col_name, label, data_type, visible FROM yj_field
WHERE panel_code='PU_ORDER' AND (label LIKE N'%单价%' OR label LIKE N'%金额%' OR label LIKE N'%税%'
      OR label LIKE N'%折扣%' OR label LIKE N'%数量%')
ORDER BY seq;
GO
PRINT '=== [3] 测试记录/P11 相关面板 ===';
SELECT panel_code, panel_name, module_group FROM yj_panel
WHERE panel_name LIKE N'%测试记录%' OR panel_name LIKE N'%测试%' OR panel_code LIKE '%TEST%'
ORDER BY panel_code;
GO
PRINT '=== [4] 含 检验/模板/大类 的表(来料检验模板基础库) ===';
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%qc%' OR TABLE_NAME LIKE '%insp%' OR TABLE_NAME LIKE '%tmpl%'
   OR TABLE_NAME LIKE '%template%'
ORDER BY TABLE_NAME;
GO
PRINT '=== [5] QC_INSP 表头+行字段(检验单打印口径) ===';
SELECT col_name, label, data_type, place, visible FROM yj_field
WHERE panel_code='QC_INSP' ORDER BY place, seq;
GO
PRINT '=== [6] 报表相关设置表行数 ===';
SELECT 'yj_report_template' AS t, COUNT(*) AS rows FROM yj_report_template
UNION ALL SELECT 'report_column_settings', COUNT(*) FROM report_column_settings
UNION ALL SELECT 'yj_attachment', COUNT(*) FROM yj_attachment;
GO
PRINT '=== [7] yj_lot_seq(批号取号)现状 ===';
SELECT TOP 20 * FROM yj_lot_seq ORDER BY 1 DESC;
GO
