SET NOCOUNT ON;
PRINT '--- 已完成领料单里,材料出库单已审核(shr 非空)的前 8 张 ---';
SELECT TOP 8 d.id, d.工单号, d.工单行号, d.领料单号, s.shr AS 审核人,
       (SELECT COUNT(*) FROM bl_material_out l WHERE l.单据编号 = d.领料单号) AS 出库明细行
FROM wo_pick_doc d
JOIN yj_doc_status s ON s.panel_code = N'MATERIAL_OUT' AND s.doc_no = d.领料单号
WHERE d.状态 = N'已完成' AND ISNULL(s.shr,N'') <> N'' AND ISNULL(s.canceled,N'N') <> 'Y'
  AND EXISTS (SELECT 1 FROM bl_material_out l WHERE l.单据编号 = d.领料单号 AND l.数量 > 0)
ORDER BY d.id DESC;
