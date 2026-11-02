SET NOCOUNT ON;
SELECT COUNT(*) AS 总行数,
       SUM(CASE WHEN ISNULL(lot_no,N'')<>'' THEN 1 ELSE 0 END) AS lot_no有值,
       SUM(CASE WHEN ISNULL([批次号],N'')<>'' THEN 1 ELSE 0 END) AS 批次号有值,
       SUM(CASE WHEN LEN(LTRIM(RTRIM(ISNULL(lot_no,N''))))=8
                 AND LTRIM(RTRIM(lot_no)) NOT LIKE N'%[^0-9]%' THEN 1 ELSE 0 END) AS lot_8位数字
FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT N'--- 最近20行 ---' AS x;
SELECT TOP 20 p.id, p.pl_no, p.pl_xc, p.lot_no, p.[批次号], p.dm, p.pl_sl, p.scx, p.[工艺路线], p.[当前工序], p.[完工状态]
FROM dbo.plang p ORDER BY p.id DESC;
