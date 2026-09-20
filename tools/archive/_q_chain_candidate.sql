-- _q_chain_candidate.sql — 挑一张可作链路实测源单的采购订单(已审核/有行/行号齐/未被占用)
SET NOCOUNT ON;
PRINT '── 候选采购订单(已审核 + 有行 + 行号齐 + 无 SL_RECV 占用)──';
SELECT TOP 8 o.单据编号, o.单据日期, o.供应商,
       (SELECT COUNT(*) FROM bl_pu_order l WHERE l.单据编号 = o.单据编号) AS 行数,
       (SELECT COUNT(*) FROM bl_pu_order l WHERE l.单据编号 = o.单据编号 AND ISNULL(l.行号,N'')=N'') AS 行号空,
       (SELECT COUNT(*) FROM form_flow_link f WHERE f.source_panel_code='PU_ORDER' AND f.source_form_no=o.单据编号 AND f.link_status='ACTIVE') AS 活跃占用,
       (SELECT TOP 1 s.shr FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号) AS 审核留痕
FROM bd_pu_order o
WHERE o.单据状态 = N'已审核'
  AND EXISTS (SELECT 1 FROM bl_pu_order l WHERE l.单据编号 = o.单据编号)
  AND NOT EXISTS (SELECT 1 FROM form_flow_link f WHERE f.source_panel_code='PU_ORDER' AND f.source_form_no=o.单据编号 AND f.link_status='ACTIVE')
ORDER BY o.id DESC;
GO
PRINT '── 该候选的明细(行号/物料/数量)──';
SELECT TOP 10 o.单据编号, l.行号, l.物料编码, l.物料名称, l.数量, l.单位 FROM bd_pu_order o
JOIN bl_pu_order l ON l.单据编号 = o.单据编号
WHERE o.单据状态 = N'已审核' AND o.id = (SELECT MAX(o2.id) FROM bd_pu_order o2 WHERE o2.单据状态=N'已审核' AND EXISTS (SELECT 1 FROM bl_pu_order l2 WHERE l2.单据编号=o2.单据编号))
ORDER BY l.id;
GO
PRINT '── 现有 SL_RECV/QC_INSP 单据数(实测前基线)──';
SELECT (SELECT COUNT(*) FROM sl_recv) AS sl_recv头, (SELECT COUNT(*) FROM sl_recv_detail) AS sl_recv行,
       (SELECT COUNT(*) FROM qc_insp) AS qc_insp头, (SELECT COUNT(*) FROM qc_insp_detail) AS qc_insp行,
       (SELECT COUNT(*) FROM bd_purchase_in) AS pi头, (SELECT COUNT(*) FROM bl_purchase_in) AS pi行;
GO
