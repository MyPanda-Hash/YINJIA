SET NOCOUNT ON;
SELECT '=== insp detail ===' AS x;
SELECT * FROM qc_insp_detail ORDER BY 单据编号, id;
GO
SELECT '=== insp head ===' AS x;
SELECT id,单据编号,单据日期,供应商代码,供应商,业务员,部门,部门名称,单据状态,审核人,审核时间,检验员,执行标准,检验类型,批次键,暂收单号,检验日期,检验方案,总结论,备注,asp_user1,asp_user2,asp_cancel
FROM qc_insp ORDER BY 单据编号;
GO
SELECT '=== catalog detail ===' AS x;
SELECT id,单据编号,检测物料类别,物料名称,物料编码,批次号,数量,计量单位,检验状态,是否合格,检验单号,检验数据记录单号,asp_user1,asp_user2,asp_cancel FROM qc_catalog_detail ORDER BY id;
GO
SELECT '=== insp rec head ===' AS x;
SELECT id,单据编号,单据日期,物料名称,物料编码,物料批次,检验日期,来料日期,来料数量,文件编码,检验依据,检验结论,处理意见,检验人,表单审核人,备注,asp_user1,asp_user2,asp_cancel FROM qc_insp_rec ORDER BY 单据编号;
GO
SELECT '=== insp rec detail ===' AS x;
SELECT * FROM qc_insp_rec_detail ORDER BY id;
GO
SELECT '=== return head ===' AS x;
SELECT * FROM qc_return ORDER BY 单据编号;
GO
SELECT '=== return detail ===' AS x;
SELECT * FROM qc_return_detail ORDER BY id;
GO
SELECT '=== links by source/target ===' AS x;
SELECT source_panel_code, target_panel_code, link_status, COUNT(*) n
FROM form_flow_link
WHERE source_panel_code IN ('QC_RECV','QC_INSP') OR target_panel_code IN ('QC_INSP','QC_RETURN','PURCHASE_IN')
GROUP BY source_panel_code,target_panel_code,link_status ORDER BY 1,2,3;
GO
SELECT '=== links from QC_INSP ===' AS x;
SELECT * FROM form_flow_link WHERE source_panel_code='QC_INSP' ORDER BY source_form_no,id;
GO
SELECT '=== doc status qc ===' AS x;
SELECT * FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN','QC_RECV') ORDER BY panel_code, doc_no;
GO
SELECT '=== bak qc_insp ===' AS x;
SELECT * FROM _bak_qcinsp_empty_20261021;
GO
SELECT '=== bak qc_insp_detail ===' AS x;
SELECT * FROM _bak_qcinsp_empty_detail_20261021;
GO
SELECT '=== bak status ===' AS x;
SELECT * FROM _bak_qcinsp_empty_status_20261021;
GO
SELECT '=== bak flow ===' AS x;
SELECT * FROM _bak_qcinsp_empty_flow_20261021;
GO
