SET NOCOUNT ON;
-- 检查这3个面板的数据库状态
SELECT N'SL_RECV' AS p, (SELECT COUNT(*) FROM yj_panel WHERE panel_code='SL_RECV') AS panel_exists,
  (SELECT COUNT(*) FROM sys.tables WHERE name='sl_recv') AS table_exists,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code='SL_RECV') AS fields
UNION ALL
SELECT N'QC_INSP', (SELECT COUNT(*) FROM yj_panel WHERE panel_code='QC_INSP'),
  (SELECT COUNT(*) FROM sys.tables WHERE name='qc_insp'),
  (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP')
UNION ALL
SELECT N'QC_RETURN', (SELECT COUNT(*) FROM yj_panel WHERE panel_code='QC_RETURN'),
  (SELECT COUNT(*) FROM sys.tables WHERE name='qc_return'),
  (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN');
-- qc_return 的列结构
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_return') ORDER BY c.column_id;
-- qc_insp_detail 的列
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_insp_detail') ORDER BY c.column_id;
