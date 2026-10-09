-- _q-topicking-guard.sql — 转领料单守卫用例:取当前状态(测试账套 HSDZ_MES_TEST,只读)
SET NOCOUNT ON;
PRINT '=== 工单 MO-2026-09-0006 / MO-2026-09-0108 当前状态 ===';
SELECT id, pl_no, pl_xc, [批次号], ja, ISNULL(pl_sl,0) AS pl_sl
FROM plang WHERE pl_no IN (N'MO-2026-09-0006', N'MO-2026-09-0108') ORDER BY pl_no, pl_xc, id;
PRINT '=== MO-2026-09-0006 名下领料单(材料出库单)+ 审核状态 ===';
SELECT h.单据编号, h.单据状态, h.加工单号, s.shr, ISNULL(s.canceled,N'N') AS canceled
FROM bd_material_out h LEFT JOIN yj_doc_status s ON s.panel_code = N'MATERIAL_OUT' AND s.doc_no = h.单据编号
WHERE h.加工单号 = N'MO-2026-09-0006' ORDER BY h.单据编号;
