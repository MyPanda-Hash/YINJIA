-- 一次性取证(2026-10-16):其他入库单/其他出库单 左栏「单据选择」中间列的选列依据
-- 用法(tools 目录):
--   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar SqlRunner.java ^
--     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10" yinjia <密码> archive\_probe-other-rail.sql
-- 结论(→ frontend/src/core/views/PanelxList.vue 的 DOC_RAIL_PANELS):
--   OTHER_IN  中间列取「供应商」(14/14 有值;部门/经手人 0/14 恒空)
--   OTHER_OUT 中间列取「部门」+「经手人」(78/79 · 78/79;无供应商列)
--   两单的「业务类型」是常量列(其他入库 14/14、其他出库 78/79 + 报损处理 1),不承载信息故不入列
SET NOCOUNT ON;
SELECT 'OTHER_IN  业务类型=' + CAST(SUM(CASE WHEN ISNULL(业务类型,'')<>'' THEN 1 ELSE 0 END) AS varchar) + '/' + CAST(COUNT(*) AS varchar)
     + ' 供应商=' + CAST(SUM(CASE WHEN ISNULL(供应商,'')<>'' THEN 1 ELSE 0 END) AS varchar)
     + ' 部门=' + CAST(SUM(CASE WHEN ISNULL(部门,'')<>'' THEN 1 ELSE 0 END) AS varchar)
     + ' 经手人=' + CAST(SUM(CASE WHEN ISNULL(经手人,'')<>'' THEN 1 ELSE 0 END) AS varchar)
     + ' ERP单号=' + CAST(SUM(CASE WHEN ISNULL(ERP单号,'')<>'' THEN 1 ELSE 0 END) AS varchar) FROM bd_other_in;
GO
SELECT 'OTHER_OUT 业务类型=' + CAST(SUM(CASE WHEN ISNULL(业务类型,'')<>'' THEN 1 ELSE 0 END) AS varchar) + '/' + CAST(COUNT(*) AS varchar)
     + ' 部门=' + CAST(SUM(CASE WHEN ISNULL(部门,'')<>'' THEN 1 ELSE 0 END) AS varchar)
     + ' 经手人=' + CAST(SUM(CASE WHEN ISNULL(经手人,'')<>'' THEN 1 ELSE 0 END) AS varchar)
     + ' ERP单号=' + CAST(SUM(CASE WHEN ISNULL(ERP单号,'')<>'' THEN 1 ELSE 0 END) AS varchar) FROM bd_other_out;
GO
SELECT 'IN  业务类型分组: ' + 业务类型 + ' x' + CAST(COUNT(*) AS varchar) FROM bd_other_in GROUP BY 业务类型;
SELECT 'OUT 业务类型分组: ' + 业务类型 + ' x' + CAST(COUNT(*) AS varchar) FROM bd_other_out GROUP BY 业务类型;
GO
SELECT TOP 6 单据编号, 业务类型, 供应商, 部门, 经手人, ERP单号, 是否已转ERP FROM bd_other_in ORDER BY 单据编号 DESC;
GO
SELECT TOP 6 单据编号, 业务类型, 部门, 经手人, ERP单号, 是否已转ERP FROM bd_other_out ORDER BY 单据编号 DESC;
GO
