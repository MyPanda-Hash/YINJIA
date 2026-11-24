SET NOCOUNT ON;
SELECT c.name, t.name AS type, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.qc_asm_insp_head') AND c.name IN (N'工单号', N'工单行号');
SELECT c.name, t.name AS type, c.max_length
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.plang') AND c.name IN ('id','pl_no','pl_xc','asp_cancel');
-- 头部工单号/行号能否对上 plang 行(表观)
SELECT COUNT(*) AS head_rows,
       SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS unmatched
  FROM dbo.qc_asm_insp_head h
  OUTER APPLY (SELECT TOP 1 x.id FROM dbo.plang x
                WHERE x.pl_no = h.[工单号] AND x.pl_xc = h.[工单行号] AND ISNULL(x.asp_cancel,'N') <> 'Y'
                ORDER BY x.id DESC) p
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
-- 同一 (pl_no, pl_xc) 是否有多行
SELECT COUNT(*) AS dup_pairs FROM (SELECT pl_no, pl_xc FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY pl_no, pl_xc HAVING COUNT(*) > 1) d;
