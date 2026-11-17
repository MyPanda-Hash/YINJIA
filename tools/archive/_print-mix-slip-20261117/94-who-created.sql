SET NOCOUNT ON;
SELECT d.id, d.工单号, d.工单行号, d.领料类型, d.领料单号, d.状态, d.创建人, d.创建时间
FROM wo_pick_doc d WHERE d.工单号 IN (N'GD-2026-11-0010', N'GD-2026-11-0009') ORDER BY d.id DESC;
GO
SELECT TOP 5 p.pl_no, p.pl_xc, p.dm, p.pl_sl FROM plang p
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY p.pl_no DESC, p.pl_xc DESC;
