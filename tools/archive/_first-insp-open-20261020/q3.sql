SELECT c.name AS 列名, t.name AS 类型, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('qc_first_insp_head') AND c.name IN (N'工单号',N'工单行号',N'客户代码')
GO
SELECT c.name AS 列名, t.name AS 类型, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('plang') AND c.name IN (N'pl_no',N'pl_xc',N'完工状态',N'ja')
GO
SELECT TOP 5 p.pl_no, p.pl_xc, h.[工单号], h.[工单行号]
FROM dbo.qc_first_insp_head h JOIN dbo.plang p ON p.pl_no=h.[工单号]
WHERE ISNULL(h.asp_cancel,'N')<>'Y'
GO
