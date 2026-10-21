SET NOCOUNT ON;
SELECT '=== insp summary ===' AS x;
SELECT 单据编号,单据日期,总结论,数量,批次号,暂收单号,审核人,单据状态 FROM qc_insp ORDER BY 单据编号;
GO
SELECT '=== details ===' AS x;
SELECT 单据编号,物料编码,物料名称,送检数量,合格数量,不合格数量,不良数量,处置方式,备注 FROM qc_insp_detail ORDER BY 单据编号,id;
GO
SELECT '=== records ===' AS x;
SELECT 单据编号,来料检验单号,物料编码,检验结论,处理意见,备注 FROM qc_insp_rec ORDER BY 单据编号;
GO
SELECT '=== catalog ===' AS x;
SELECT 检验单号,物料编码,是否合格,检验状态 FROM qc_catalog_detail ORDER BY 检验单号,物料编码;
GO
SELECT '=== returns ===' AS x;
SELECT 单据编号,单据日期,检验单号,数量,单据状态,审核人,审核时间,审批人,审批时间,是否已转ERP,ERP单号,转ERP操作人,转ERP时间 FROM qc_return ORDER BY 单据编号;
GO
SELECT '=== return details ===' AS x;
SELECT 单据编号,物料编码,退货数量,送检数量,不良原因,批次号 FROM qc_return_detail ORDER BY 单据编号;
GO
SELECT '=== approvals ===' AS x;
SELECT panel_code,form_no,action,result,operator,opinion,create_time FROM yj_form_approval WHERE panel_code='QC_RETURN' ORDER BY form_no;
GO
SELECT '=== status ===' AS x;
SELECT panel_code,COUNT(*) n,SUM(CASE WHEN shr=N'冯敏' THEN 1 ELSE 0 END) fengmin FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN') GROUP BY panel_code;
GO
SELECT '=== pi links ===' AS x;
SELECT COUNT(*) n FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE';
GO
SELECT '=== dates ===' AS x;
SELECT COUNT(*) bad FROM qc_insp i WHERE i.单据日期<>i.检验日期 OR LEFT(i.审核时间,10)<>i.单据日期;
SELECT COUNT(*) bad FROM qc_return r WHERE LEFT(r.审核时间,10)<>r.单据日期 OR LEFT(r.审批时间,10)<>r.单据日期 OR r.转ERP时间<>r.单据日期;
GO
