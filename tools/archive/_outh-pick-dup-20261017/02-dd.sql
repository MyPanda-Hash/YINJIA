SET NOCOUNT ON;
SELECT name FROM sys.databases ORDER BY name;
SELECT COUNT(*) AS LL行数 FROM dbo.outh WHERE 单据编号 LIKE 'LL%';
SELECT TOP 10 id, src, rid, 单据编号, 单据类型, 工单号, asp_user1 FROM dbo.outh WHERE 单据编号 LIKE 'LL%' ORDER BY id DESC;
SELECT COUNT(*) AS 无工单号出库行 FROM dbo.outh WHERE src=6 AND (工单号 IS NULL OR RTRIM(工单号)='');
SELECT TOP 5 id, 加工单号, 工单行号, 单据编号 FROM bd_material_out WHERE 单据编号 LIKE 'LL%';
