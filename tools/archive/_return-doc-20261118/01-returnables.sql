SET NOCOUNT ON;
-- 可退单据候选:已完成 + 材料出库单已审核(shr 非空)
SELECT TOP 10 d.id, d.领料单号 AS outno, d.工单号 AS wono, d.工单行号 AS woline,
       d.状态 AS state, d.领料类型 AS kind,
       ISNULL(s.shr, N'') AS auditor, ISNULL(s.doc_no, N'') AS status_docno
  FROM dbo.wo_pick_doc d
  LEFT JOIN dbo.yj_doc_status s ON s.panel_code = N'MATERIAL_OUT' AND s.doc_no = d.领料单号
 WHERE d.状态 = N'已完成' AND ISNULL(d.asp_cancel,'N') <> 'Y'
 ORDER BY d.id DESC;
GO
SET NOCOUNT ON;
-- 这些单的已领 / 已退(按物料)
SELECT TOP 20 o.单据编号 AS outno, o.材料编码 AS mat, o.数量 AS picked,
       ISNULL((SELECT SUM(r.退料数量) FROM dbo.wo_pick_return r
                WHERE r.领料单号 = o.单据编号 AND r.物料编码 = o.材料编码
                  AND ISNULL(r.asp_cancel,'N') <> 'Y'), 0) AS returned
  FROM dbo.bl_material_out o
 WHERE o.单据编号 IN (SELECT TOP 5 领料单号 FROM dbo.wo_pick_doc
                       WHERE 状态 = N'已完成' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC)
   AND ISNULL(o.asp_cancel,'N') <> 'Y'
 ORDER BY o.单据编号, o.材料编码;
