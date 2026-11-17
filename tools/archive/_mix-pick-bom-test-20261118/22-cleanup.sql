SET NOCOUNT ON;
DELETE FROM wo_pick_line WHERE 单头id IN (SELECT id FROM wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3);
SELECT @@ROWCOUNT AS 删领料明细;
GO
DELETE FROM wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3;
SELECT @@ROWCOUNT AS 删台账行;
GO
SELECT COUNT(*) AS 剩余未开单行数 FROM plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废');
GO
SELECT COUNT(*) AS 表格残留 FROM wo_pick_line l LEFT JOIN wo_pick_doc d ON d.id = l.单头id WHERE d.id IS NULL;
