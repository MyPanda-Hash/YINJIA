SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME=N'plang' AND (COLUMN_NAME LIKE N'%路线%' OR COLUMN_NAME LIKE N'%工序%' OR COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME LIKE N'%状态%' OR COLUMN_NAME LIKE N'%工艺%');
SELECT N'--- count ---' AS x, COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=N'plang';
SELECT N'--- sample lot_no ---' AS x;
SELECT TOP 8 p.id, p.pl_no, p.pl_xc, p.lot_no, p.dm, p.mc, p.pl_sl, p.scx
  FROM dbo.plang p WHERE ISNULL(p.lot_no,N'')<>'' ORDER BY p.id DESC;
SELECT N'--- lot_no length/dist ---' AS x;
SELECT LEN(LTRIM(RTRIM(lot_no))) AS len_, COUNT(*) AS n FROM dbo.plang WHERE ISNULL(lot_no,N'')<>'' GROUP BY LEN(LTRIM(RTRIM(lot_no)));
