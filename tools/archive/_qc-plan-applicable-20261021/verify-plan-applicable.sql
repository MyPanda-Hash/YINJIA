SET NOCOUNT ON;
PRINT '=== plans ===';
SELECT 方案编码, 方案名称, 检验类型, 适用单据, 停用, 状态 FROM bs_qc_plan ORDER BY 方案编码;
PRINT '=== items count by plan ===';
SELECT 方案编码, COUNT(*) AS 条数 FROM bs_qc_item WHERE ISNULL(asp_cancel,N'N')<>N'Y' GROUP BY 方案编码 ORDER BY 方案编码;
PRINT '=== 组装成品 applicable plans (QP-ASM-00 first) ===';
SELECT 方案编码, 方案名称, 检验类型, 适用单据
FROM bs_qc_plan
WHERE ISNULL(asp_cancel,N'N')<>N'Y'
  AND CHARINDEX(N',' + N'QC_ASM_INSP' + N',', N',' + REPLACE(ISNULL(适用单据,N''), N' ', N'') + N',') > 0
ORDER BY ISNULL(停用,0), 方案编码, id;
PRINT '=== QP-ASM-00 items ===';
SELECT 序号, 项目编码, 项目名称, 检验内容, 检验标准, 检验方法, 检验数量
FROM bs_qc_item WHERE 方案编码=N'QP-ASM-00' AND ISNULL(asp_cancel,N'N')<>N'Y' ORDER BY 序号;
PRINT '=== 首件/制程 applicable plans ===';
SELECT 方案编码, 适用单据 FROM bs_qc_plan
WHERE CHARINDEX(N'QC_FIRST_INSP', ISNULL(适用单据,N'')) > 0 OR CHARINDEX(N'QC_PROC_INSP', ISNULL(适用单据,N'')) > 0
ORDER BY 方案编码;
