/* 选一个「工序台账 + 已审核报工」都有的真实工单行(批次 20261016 的 15 行),只读。 */
SET NOCOUNT ON;
SELECT p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,
       (SELECT COUNT(*) FROM dbo.wo_process_line l
         WHERE l.工单行id = p.id AND ISNULL(l.asp_cancel,N'N')<>'Y') AS 工序台账行数,
       (SELECT COUNT(*) FROM dbo.scjl s
         JOIN dbo.plang_pc pc ON pc.id = s.gd_id
        WHERE pc.plang_id = p.id AND ISNULL(s.asp_cancel,N'N')<>'Y') AS 报工行数_锚定,
       (SELECT COUNT(*) FROM dbo.scjl s
         JOIN dbo.plang_pc pc ON pc.id = s.gd_id
        WHERE pc.plang_id = p.id AND ISNULL(s.asp_cancel,N'N')<>'Y' AND s.wgzt = 'Y') AS 已审核报工行数,
       (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh = p.pl_no AND ISNULL(s.asp_cancel,N'N')<>'Y') AS 整单报工
  FROM dbo.plang p
 WHERE p.id BETWEEN 411 AND 425
 ORDER BY p.id;
GO
