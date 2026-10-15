SET NOCOUNT ON;
PRINT '=== 工艺路线清单(五道工序覆盖) ===';
SELECT 工艺路线编码, 加工顺序, 工序名称, ISNULL(换算率,0) AS rate FROM dbo.bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' AND 工艺路线编码 IN (N'GY-CB-STD',N'GY-2026-10-0001',N'GY-2026-10-0003') ORDER BY 工艺路线编码, 加工顺序;
PRINT '=== 产能来源视图定义长度 ===';
SELECT OBJECT_NAME(object_id) AS vw, LEN(OBJECT_DEFINITION(object_id)) AS def_len FROM sys.views WHERE name=N'v_line_load';
PRINT '=== 成本核算:出入库成本列 ===';
SELECT TOP 5 name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.outh') AND (name LIKE N'%成本%' OR name LIKE N'%金额%' OR name LIKE N'%价%');
PRINT '=== 检验单行号绑定情况 ===';
SELECT 'qc_mold' AS t, COUNT(*) AS total, SUM(CASE WHEN ISNULL(工单行号,0)>0 THEN 1 ELSE 0 END) AS with_line FROM dbo.qc_mold_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_cut', COUNT(*), SUM(CASE WHEN ISNULL(工单行号,0)>0 THEN 1 ELSE 0 END) FROM dbo.qc_cut_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_asm', COUNT(*), SUM(CASE WHEN ISNULL(工单行号,0)>0 THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y';
