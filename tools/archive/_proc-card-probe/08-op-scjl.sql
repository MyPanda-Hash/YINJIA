SET NOCOUNT ON;
SELECT N'--- bs_op cols ---' AS x;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=N'bs_op' ORDER BY ORDINAL_POSITION;
SELECT N'--- bs_op rows ---' AS x;
SELECT TOP 10 * FROM dbo.bs_op;
SELECT N'--- scjl anchor sample ---' AS x;
SELECT TOP 10 s.id, s.工单号, s.gldh, s.gxdm, s.sl, s.wgzt, s.gd_id, s.[批次号], s.ywman, CONVERT(varchar(19),s.wgsj,120) AS wgsj FROM dbo.scjl s ORDER BY s.id DESC;
