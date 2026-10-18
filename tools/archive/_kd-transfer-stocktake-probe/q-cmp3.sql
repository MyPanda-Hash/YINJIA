SET NOCOUNT ON;
PRINT '=== 两种口径对比 ===';
SELECT
 (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转')
 + (SELECT -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 不含结转净额,
 (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y')
 + (SELECT -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 含结转净额,
 (SELECT SUM(yl) FROM kucun) AS 当前kucun;
PRINT '=== 结转行数量 vs 差额 ===';
SELECT SUM(数量) AS 结转合计 FROM inh WHERE 单据编号=N'JZ-202609';
