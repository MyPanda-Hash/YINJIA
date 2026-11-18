SET NOCOUNT ON;
SELECT
 (SELECT COUNT(*) FROM plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')) AS 未开单行数,
 (SELECT COUNT(*) FROM bd_material_ret WHERE 单据编号 = N'TL-2026-11-0009') AS 保留退料单,
 (SELECT COUNT(*) FROM scjl WHERE ISNULL(报工单号,N'') = N'BG-2026-11-0001') AS 保留报工单,
 (SELECT COUNT(*) FROM bd_material_out WHERE 单据编号 = N'LL-2026-11-0031') AS 出库草稿残留,
 (SELECT COUNT(*) FROM wo_mixing_list WHERE 单据编号 = N'PL2611170001') AS 混料残留;
