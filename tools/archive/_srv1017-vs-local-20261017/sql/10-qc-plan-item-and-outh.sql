SET NOCOUNT ON;
PRINT '=== bs_qc_plan(服务器独有2行) ===';
SELECT * FROM HSDZ_MES_SRV1017.dbo.bs_qc_plan;
PRINT '=== bs_qc_item 前14行 ===';
SELECT * FROM HSDZ_MES_SRV1017.dbo.bs_qc_item;
PRINT '=== outh 差异7行(审核字段) ===';
SELECT l.id, l.审核 AS 本地审核, s.审核 AS 服务器审核, l.asp_time3 AS 本地t3, s.asp_time3 AS 服务器t3
FROM HSDZ_MES.dbo.outh l JOIN HSDZ_MES_SRV1017.dbo.outh s ON s.id=l.id
WHERE ISNULL(l.审核,'')<>ISNULL(s.审核,'') OR ISNULL(l.asp_time3,'')<>ISNULL(s.asp_time3,'');
