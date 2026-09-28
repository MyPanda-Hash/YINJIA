SET NOCOUNT ON;
SELECT 'GFDA面板存在(restore-gfda效果)' AS 检查, COUNT(*) AS n FROM yj_panel WHERE panel_code='GFDA';
SELECT '有中文注释的表数(table-comments效果)' AS 检查, COUNT(DISTINCT ep.major_id) AS n
FROM sys.extended_properties ep WHERE ep.name='MS_Description' AND ep.minor_id=0 AND ep.class=1;
SELECT 'spec.test 标准库条目(spec-testlib效果)' AS 检查, COUNT(*) AS n FROM yj_std_lib WHERE lib_code=N'spec.test';
SELECT 'INV查询字段数(basedata-query效果)' AS 检查, COUNT(*) AS n
FROM yj_field WHERE panel_code='INV' AND place LIKE '%query%';
SELECT 'RD域残留单据(rd-cleanup效果)' AS 检查,
  (SELECT COUNT(*) FROM rd_plan) AS rd_plan行, (SELECT COUNT(*) FROM rd_approval) AS rd_approval行;
