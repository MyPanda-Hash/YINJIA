-- Read-only reproduction: scheduled legacy rows must carry a positive quantity.
SET NOCOUNT ON;
SELECT DB_NAME() AS db_name, name FROM sys.tables WHERE name IN (N'plang',N'plang_pc',N'plang__pc');
SELECT t.name AS table_name,c.column_id,c.name,ty.name AS type_name,c.max_length,c.precision,c.scale,dc.definition
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
WHERE t.name IN (N'plang',N'plang_pc') ORDER BY t.name,c.column_id;
SELECT TOP 20 pc.id,pc.plang_id,pc.pl_no,pc.pl_xc,pc.scx,pc.pl_sl AS scheduled_qty,p.pl_sl AS order_qty,p.xq_sl AS demand_qty
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' ORDER BY pc.id DESC;
SELECT COUNT(*) AS zero_quantity_scheduled_rows FROM dbo.plang_pc pc
JOIN dbo.plang p ON p.id=pc.plang_id
WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(pc.pl_sl,0)<=0;
IF EXISTS(SELECT 1 FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id=pc.plang_id
 WHERE ISNULL(pc.asp_cancel,'N')<>'Y' AND ISNULL(pc.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(pc.pl_sl,0)<=0)
 THROW 51000,'FAIL: scheduled plang_pc.pl_sl is zero',1;
PRINT 'PASS: scheduled plang_pc.pl_sl is positive';
