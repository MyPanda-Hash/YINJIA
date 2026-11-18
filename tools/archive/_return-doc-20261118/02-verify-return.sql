SET NOCOUNT ON;
-- 本轮从手机端提交出来的生产退料单(LL-2026-11-0006 的第二张退料单)
SELECT TOP 5 h.单据编号 AS docno, h.业务类型 AS biztype, h.加工单号 AS wono, h.工单行号 AS woline,
       h.单据状态 AS state, h.备注 AS memo, h.asp_user1 AS usr
  FROM dbo.bd_material_ret h
 WHERE h.单据编号 IN (SELECT TOP 3 doc_no FROM dbo.yj_doc_status
                       WHERE panel_code = N'MATERIAL_RET' ORDER BY doc_no DESC)
 ORDER BY h.单据编号 DESC;
GO
SET NOCOUNT ON;
-- 明细行(退的是哪两项、各多少)
SELECT d.单据编号 AS docno, d.材料编码 AS mat, d.材料名称 AS name, d.数量 AS qty, d.计量单位 AS uom
  FROM dbo.bl_material_ret d
 WHERE d.单据编号 IN (SELECT TOP 3 doc_no FROM dbo.yj_doc_status
                       WHERE panel_code = N'MATERIAL_RET' ORDER BY doc_no DESC)
 ORDER BY d.单据编号 DESC, d.行号;
GO
SET NOCOUNT ON;
-- 退料台账(可退量的唯一真源)
SELECT TOP 10 r.领料单号 AS outno, r.退料单号 AS retno, r.物料编码 AS mat, r.退料数量 AS qty,
       r.asp_user1 AS usr
  FROM dbo.wo_pick_return r
 WHERE r.领料单号 = N'LL-2026-11-0006' AND ISNULL(r.asp_cancel,'N') <> 'Y'
 ORDER BY r.id DESC;
GO
SET NOCOUNT ON;
-- 该单的已领 / 已退 / 可退(应与页面显示一致:热缩袋 10/5/5、标签 10/2/8、无纺布 5/0/5)
SELECT o.材料编码 AS mat, o.数量 AS picked,
       ISNULL((SELECT SUM(r.退料数量) FROM dbo.wo_pick_return r
                WHERE r.领料单号 = o.单据编号 AND r.物料编码 = o.材料编码
                  AND ISNULL(r.asp_cancel,'N') <> 'Y'), 0) AS returned
  FROM dbo.bl_material_out o
 WHERE o.单据编号 = N'LL-2026-11-0006' AND ISNULL(o.asp_cancel,'N') <> 'Y'
 ORDER BY o.材料编码;
