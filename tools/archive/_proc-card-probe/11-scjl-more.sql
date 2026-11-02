SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME=N'scjl' AND (COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME LIKE N'%报工%' OR COLUMN_NAME LIKE N'%单号%');
SELECT N'--- total cols ---' AS x, COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=N'scjl';
SELECT N'--- sample ---' AS x;
SELECT TOP 8 s.id, s.sc_no, s.gldh, s.gd_id, s.gxdm, s.sl, s.wgzt, s.[批次号], s.ywman, s.sc_date, s.wgsj FROM dbo.scjl s ORDER BY s.id DESC;
