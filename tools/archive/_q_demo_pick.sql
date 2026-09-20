SET NOCOUNT ON;
PRINT '── 候选源订单(已审核 + 有行号 + 无活跃占用)──';
SELECT o.单据编号, o.供应商,
       (SELECT COUNT(*) FROM bl_pu_order l WHERE l.单据编号=o.单据编号) AS 行数,
       (SELECT COUNT(*) FROM bl_pu_order l WHERE l.单据编号=o.单据编号 AND ISNULL(l.行号,N'')=N'') AS 行号空,
       (SELECT COUNT(*) FROM form_flow_link f WHERE f.source_panel_code='PU_ORDER' AND f.source_form_no=o.单据编号 AND f.link_status='ACTIVE') AS 活跃占用,
       (SELECT ISNULL(s.shr,N'(未审)') FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号) AS 审核留痕,
       (SELECT ISNULL(s.erp_close_state,N'(未关闭)') FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号) AS 金蝶关闭
FROM bd_pu_order o
WHERE o.单据编号 IN ('YJ-20260915-06','YJ-20260915-08','YJ-20260915-12','YJ-20260916-03','YJ-20260916-04','YJ-20260915-09','YJ-20260915-10','YJ-20260915-11')
ORDER BY o.单据编号;
GO
PRINT '── 这两张单的明细(行号/物料/数量/单价)──';
SELECT o.单据编号, l.行号, l.物料编码, l.数量, l.单位, l.单价 FROM bd_pu_order o JOIN bl_pu_order l ON l.单据编号=o.单据编号
WHERE o.单据编号 IN ('YJ-20260915-06','YJ-20260915-08') ORDER BY o.单据编号 DESC, l.id;
GO
PRINT '── 现有 SL/IJ/PI/TH 编号水位 ──';
SELECT (SELECT MAX(单据编号) FROM sl_recv) AS 最大暂收, (SELECT MAX(单据编号) FROM qc_insp) AS 最大检验,
       (SELECT MAX(单据编号) FROM bd_purchase_in) AS 最大入库, (SELECT MAX(单据编号) FROM qc_return) AS 最大退回;
GO
