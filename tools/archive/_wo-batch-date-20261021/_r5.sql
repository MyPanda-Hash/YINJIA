SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN (N'工单号',N'pl_no',N'gldh',N'加工单号',N'单据编号',N'合同号',N'源工单号',N'根工单号',N'父单号',N'子单号',N'tm')
  AND t.is_ms_shipped=0 AND t.name NOT LIKE N'[_]bak[_]%'
ORDER BY t.name, c.name;
GO
