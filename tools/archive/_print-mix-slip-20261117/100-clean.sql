SET NOCOUNT ON;
DELETE FROM dbo.wo_pick_line WHERE 单头id IN (SELECT id FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-11-0007' AND 工单行号 IN (4,5));
SELECT @@ROWCOUNT AS 删明细;
DELETE FROM dbo.wo_pick_doc WHERE 工单号 = N'GD-2026-11-0007' AND 工单行号 IN (4,5);
SELECT @@ROWCOUNT AS 删台账;
GO
SELECT COUNT(*) AS 未开单行数 FROM plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废');
