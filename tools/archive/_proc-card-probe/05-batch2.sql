SET NOCOUNT ON;
SELECT N'--- 批次号 分布 ---' AS x;
SELECT TOP 15 [批次号], COUNT(*) AS n, COUNT(DISTINCT pl_no) AS 工单数
FROM dbo.plang WHERE ISNULL([批次号],N'')<>'' AND ISNULL(asp_cancel,'N')<>'Y'
GROUP BY [批次号] ORDER BY [批次号] DESC;
SELECT N'--- 批次号 长度 ---' AS x;
SELECT LEN(LTRIM(RTRIM([批次号]))) AS len_, COUNT(*) AS n FROM dbo.plang
WHERE ISNULL([批次号],N'')<>'' GROUP BY LEN(LTRIM(RTRIM([批次号])));
SELECT N'--- lot_no 非空样例(TEST用不上,正式无) ---' AS x;
SELECT TOP 5 id, pl_no, lot_no FROM dbo.plang WHERE ISNULL(lot_no,N'')<>'' ORDER BY id DESC;
