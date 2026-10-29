/* 找「已有工序台账 + 已有已审核报工」的工单行,优先近批次(只读)。 */
SET NOCOUNT ON;
SELECT TOP 20 p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,
       COALESCE(NULLIF(LTRIM(RTRIM(p.[批次号])),N''),
                (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])),N'') FROM dbo.plang_pc pc WHERE pc.plang_id=p.id ORDER BY pc.id DESC),
                CONVERT(varchar(8), p.pl_date, 112)) AS 解析批次,
       (SELECT COUNT(*) FROM dbo.wo_process_line l WHERE l.工单行id=p.id AND ISNULL(l.asp_cancel,N'N')<>'Y') AS 台账,
       (SELECT COUNT(*) FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id
         WHERE pc.plang_id=p.id AND ISNULL(s.asp_cancel,N'N')<>'Y' AND s.wgzt='Y') AS 已审核报工
  FROM dbo.plang p
 WHERE ISNULL(p.asp_cancel,N'N')<>'Y'
   AND EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.工单行id=p.id AND ISNULL(l.asp_cancel,N'N')<>'Y')
   AND EXISTS (SELECT 1 FROM dbo.scjl s JOIN dbo.plang_pc pc ON pc.id=s.gd_id
                WHERE pc.plang_id=p.id AND ISNULL(s.asp_cancel,N'N')<>'Y' AND s.wgzt='Y')
 ORDER BY p.id DESC;
GO
