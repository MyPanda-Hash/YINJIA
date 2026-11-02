SET NOCOUNT ON;
-- 只清刚才脚本转出、且从未开过领料单的工单(避免动到别的数据)
DECLARE @wo TABLE (no varchar(30), xc int);
INSERT INTO @wo SELECT pl_no, pl_xc FROM plang
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND pl_date >= DATEADD(hour,-2,GETDATE());

DELETE FROM plang WHERE EXISTS (SELECT 1 FROM @wo w WHERE w.no=plang.pl_no AND w.xc=plang.pl_xc)
   AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号=plang.pl_no AND d.工单行号=plang.pl_xc);
SELECT '剩余工单' k, COUNT(*) n FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y';
