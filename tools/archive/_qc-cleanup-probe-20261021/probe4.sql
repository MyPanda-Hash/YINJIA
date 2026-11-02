SET NOCOUNT ON;
SELECT '=== sl_recv status sample ===' AS x;
SELECT TOP 20 * FROM yj_doc_status WHERE panel_code='QC_RECV' ORDER BY doc_no DESC;
GO
SELECT '=== need insp lines ===' AS x;
SELECT h.单据编号 AS recv_no, h.单据日期 AS recv_date, ds.saved, ds.shr, ds.shsj, ds.canceled, ds.archived,
       h.供应商, h.供应商代码, h.业务员, h.部门, h.部门名称, h.采购订单号,
       h.批次号 AS head_batch, h.批次键,
       d.id AS line_id, d.物料编码, d.物料名称, d.规格型号, d.数量, d.计量单位, d.批次号 AS line_batch,
       i.来料检验,
       ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l WHERE l.source_panel_code='QC_RECV' AND l.source_form_no=h.单据编号 AND l.source_line_key=h.单据编号+'#'+CAST(d.id AS varchar) AND l.link_status='ACTIVE'),0) AS linked_qty
FROM sl_recv h
JOIN sl_recv_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
LEFT JOIN yj_doc_status ds ON ds.panel_code='QC_RECV' AND ds.doc_no=h.单据编号
WHERE LTRIM(RTRIM(i.来料检验))='是'
ORDER BY h.单据日期, h.单据编号, d.id;
GO
SELECT '=== recv need-insp totals ===' AS x;
SELECT COUNT(DISTINCT h.单据编号) docs, COUNT(*) lines, SUM(d.数量) qty
FROM sl_recv h JOIN sl_recv_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
WHERE LTRIM(RTRIM(i.来料检验))='是';
GO
SELECT '=== backup counts ===' AS x;
SELECT '_bak_qcinsp_empty_20261021' t, COUNT(*) n FROM _bak_qcinsp_empty_20261021
UNION ALL SELECT '_bak_detail', COUNT(*) FROM _bak_qcinsp_empty_detail_20261021
UNION ALL SELECT '_bak_status', COUNT(*) FROM _bak_qcinsp_empty_status_20261021
UNION ALL SELECT '_bak_flow', COUNT(*) FROM _bak_qcinsp_empty_flow_20261021;
GO
SELECT '=== bak insp ===' AS x;
SELECT * FROM _bak_qcinsp_empty_20261021;
GO
SELECT '=== bak detail ===' AS x;
SELECT * FROM _bak_qcinsp_empty_detail_20261021;
GO
SELECT '=== bak status ===' AS x;
SELECT * FROM _bak_qcinsp_empty_status_20261021;
GO
SELECT '=== bak flow ===' AS x;
SELECT * FROM _bak_qcinsp_empty_flow_20261021;
GO
SELECT '=== approval tables ===' AS x;
SELECT t.name FROM sys.tables t WHERE t.name LIKE '%approval%' OR t.name LIKE '%audit%' OR t.name LIKE '%doc%' ORDER BY t.name;
GO
SELECT '=== insp approval rows ===' AS x;
SELECT * FROM yj_doc_approval WHERE panel_code='QC_INSP' ORDER BY doc_no;
GO
