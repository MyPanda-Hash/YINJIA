SET NOCOUNT ON;
PRINT '== 材料出库单(MATERIAL_OUT)面板配置 ==';
SELECT panel_code, panel_name, category, mode, prefix, code_col, group_col, line_table, head_table
FROM yj_panel WHERE panel_code = N'MATERIAL_OUT';
PRINT '== bd_material_out 单号前缀段分布 ==';
SELECT LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) AS pf, COUNT(*) AS n, MIN(单据编号) AS min_no, MAX(单据编号) AS max_no
FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) ORDER BY n DESC;
PRINT '== 最近 8 张材料出库单 ==';
SELECT TOP 8 单据编号, CONVERT(nvarchar(10),单据日期,120) AS 单据日期, 加工单号, ISNULL(是否已转ERP,N'') AS 转ERP, ISNULL(ERP单号,N'') AS ERP单号,
       CONVERT(nvarchar(19),asp_time1,120) AS 创建时间
FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
PRINT '== 号池里 CL / LL 的取号记录 ==';
SELECT lb, COUNT(*) AS n, MIN(dh) AS min_dh, MAX(dh) AS max_dh, MAX(CONVERT(nvarchar(19),asp_time1,120)) AS 最后取号
FROM s_allno WHERE lb IN (N'CL', N'LL') GROUP BY lb;
