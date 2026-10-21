SET NOCOUNT ON;
SELECT '=== counts ===' AS x;
SELECT 'qc_insp' t, COUNT(*) n FROM qc_insp
UNION ALL SELECT 'qc_insp_detail', COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'qc_catalog', COUNT(*) FROM qc_catalog
UNION ALL SELECT 'qc_catalog_detail', COUNT(*) FROM qc_catalog_detail
UNION ALL SELECT 'qc_insp_rec', COUNT(*) FROM qc_insp_rec
UNION ALL SELECT 'qc_insp_rec_detail', COUNT(*) FROM qc_insp_rec_detail
UNION ALL SELECT 'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT 'qc_return_detail', COUNT(*) FROM qc_return_detail;
GO
SELECT '=== insp heads ===' AS x;
SELECT 单据编号,单据日期,供应商,业务员,采购订单号,批次号,批次键,暂收单号,检验日期,审核人,审核时间,检验员,单据状态,数量,总结论,检验类型
FROM qc_insp ORDER BY 单据日期,单据编号;
GO
SELECT '=== insp lines ===' AS x;
SELECT d.单据编号,d.物料编码,d.物料名称,d.送检数量,d.单位,d.合格数量,d.不合格数量,d.不良数量,d.处置方式,d.日期,d.批次号,d.采购订单行号
FROM qc_insp_detail d ORDER BY d.单据编号,d.id;
GO
SELECT '=== catalog ===' AS x;
SELECT h.单据编号,h.单据日期,COUNT(d.id) rows FROM qc_catalog h LEFT JOIN qc_catalog_detail d ON d.单据编号=h.单据编号 GROUP BY h.单据编号,h.单据日期;
SELECT d.单据编号,d.检测物料类别,d.物料名称,d.物料编码,d.批次号,d.数量,d.计量单位,d.检验状态,d.是否合格,d.检验单号,d.检验数据记录单号 FROM qc_catalog_detail d ORDER BY d.id;
GO
SELECT '=== records ===' AS x;
SELECT 单据编号,单据日期,物料名称,物料编码,物料批次,检验日期,来料日期,来料数量,检验结论,检验人,表单审核人,来料检验单号 FROM qc_insp_rec ORDER BY 单据日期,单据编号;
GO
SELECT '=== record details sample ===' AS x;
SELECT TOP 30 * FROM qc_insp_rec_detail ORDER BY id;
GO
SELECT '=== returns ===' AS x;
SELECT 单据编号,单据日期,供应商,数量,单据状态,检验单号,批次号,退货类型,退货原因,经手人 FROM qc_return ORDER BY 单据日期,单据编号;
GO
SELECT '=== return lines ===' AS x;
SELECT d.单据编号,d.物料编码,d.物料名称,d.退货数量,d.送检数量,d.计量单位,d.批次号,d.不良原因,d.日期 FROM qc_return_detail d ORDER BY d.单据编号,d.id;
GO
SELECT '=== statuses ===' AS x;
SELECT panel_code,COUNT(*) n,SUM(CASE WHEN shr=N'冯敏' THEN 1 ELSE 0 END) fengmin FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN') GROUP BY panel_code;
GO
SELECT '=== links ===' AS x;
SELECT source_panel_code,target_panel_code,link_status,COUNT(*) n FROM form_flow_link WHERE source_panel_code IN ('QC_RECV','QC_INSP') GROUP BY source_panel_code,target_panel_code,link_status ORDER BY 1,2,3;
GO
SELECT '=== PI active ===' AS x;
SELECT COUNT(*) n FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE';
GO
SELECT '=== allno new ===' AS x;
SELECT lb,dh,ny FROM s_allno WHERE dh LIKE 'IJ-2026-10-02%' OR dh LIKE 'JYML-2026-10-%' OR dh LIKE 'JYSJ-2026-10-01%' OR dh LIKE 'TH-2026-10-%' ORDER BY lb,dh;
GO
