SET NOCOUNT ON;
SELECT c.name,c.max_length AS order_length,d.max_length AS schedule_length FROM sys.columns c JOIN sys.columns d ON c.name=d.name
WHERE c.object_id=OBJECT_ID(N'dbo.plang') AND d.object_id=OBJECT_ID(N'dbo.plang_pc') AND c.max_length<>d.max_length;
SELECT pc.id,pc.plang_id,pc.pl_sl,p.pl_sl,p.xq_sl,LEN(p.khdm) AS customer_length,LEN(p.od_no) AS order_length,LEN(p.lb) AS team_length
FROM dbo.plang_pc pc LEFT JOIN dbo.plang p ON p.id=pc.plang_id WHERE ISNULL(pc.asp_cancel,'N')<>'Y';
SELECT name FROM sys.triggers WHERE parent_id IN(OBJECT_ID(N'dbo.plang'),OBJECT_ID(N'dbo.plang_pc'));
