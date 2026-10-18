SET NOCOUNT ON;
PRINT '=== 1. kucun 总量 vs 流水净额(排除月结结转) ===';
SELECT (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转')
     - (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun) AS 库存合计;
PRINT '=== 2. 结转行是否被误计入 kucun ===';
SELECT COUNT(*) 结转行数, CAST(SUM(数量) AS decimal(18,4)) 结转合计 FROM inh WHERE ISNULL(单据类型,'')=N'月结结转';
PRINT '=== 3. 若把结转也算进去会怎样(不该等于 kucun) ===';
SELECT (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y')
     - (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 含结转净额;
