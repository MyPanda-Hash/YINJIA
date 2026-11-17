SET NOCOUNT ON;
SELECT
 (SELECT COUNT(*) FROM bd_other_out WHERE 单据编号 IN (N'OO-2026-11-0007',N'OO-2026-11-0009',N'OO-2026-11-0010')) AS 其他出库残留,
 (SELECT COUNT(*) FROM bd_material_ret WHERE 单据编号 IN (N'TL-2026-11-0010',N'TL-2026-11-0011')) AS 退料草稿残留,
 (SELECT COUNT(*) FROM bd_material_ret WHERE 单据编号 = N'TL-2026-11-0009') AS 保留退料单,
 (SELECT COUNT(*) FROM scjl WHERE ISNULL(报工单号,N'') = N'BG-2026-11-0001') AS 保留报工单,
 (SELECT COUNT(*) FROM wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' AND 工单行号 = 3) AS 领料台账残留,
 (SELECT COUNT(*) FROM wo_mixing_list WHERE 单据编号 = N'PL2611170001') AS 混料记录残留;
GO
SELECT COUNT(*) AS 未开单行数 FROM plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废');
