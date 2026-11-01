SET NOCOUNT ON;
DECLARE @m TABLE(old_no nvarchar(56));
INSERT @m SELECT DISTINCT p.pl_no FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
SELECT s.id, s.sc_no, s.gldh, s.[工单行号], ISNULL(s.[批次号],N'') 批次号, ISNULL(s.asp_cancel,N'') 作废,
       CONVERT(varchar(19),s.asp_time1,120) 创建, ISNULL(s.post_no,N'') 入库单号, ISNULL(s.wgzt,N'') wgzt
FROM dbo.scjl s JOIN @m m ON s.sc_no=m.old_no ORDER BY s.id;
GO
SELECT COUNT(*) AS 号池同号 FROM dbo.s_allno a WHERE a.dh IN (SELECT dh FROM dbo.s_allno WHERE dh LIKE N'GD-2026-10-%');
GO
SELECT i.name AS idx, i.is_unique, COL_NAME(ic.object_id, ic.column_id) AS col
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
WHERE i.object_id=OBJECT_ID('dbo.s_allno') ORDER BY i.name, ic.key_ordinal;
GO
