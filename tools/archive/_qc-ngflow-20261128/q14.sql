SELECT r.单据编号, r.检验结论, r.不合格品处理单号,
       (SELECT TOP 1 s.pending FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号) AS recPending,
       (SELECT TOP 1 s.shr FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号) AS recShr
FROM qc_insp_rec r WHERE r.单据编号 = N'JYSJ-2026-11-0021';
GO
SELECT 单据编号, 单据日期, 供应商, 采购单号, 产品名称, 总数量, 不合格品数量, 不合格品比例, 不良说明,
       检验单号, 检验数据记录单号, 批次号
FROM qc_tc_in WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC;
GO
SELECT * FROM form_flow_link WHERE source_panel_code IN ('QC_INSP_REC','QC_INSP') AND create_time > DATEADD(hour,-1,GETDATE()) ORDER BY id DESC;
GO
SELECT 单据编号, 物料编码, 送检数量, 合格数量, 不合格数量, 特采, 入库单号 FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0007';
