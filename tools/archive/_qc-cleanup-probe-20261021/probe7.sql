SET NOCOUNT ON;
SELECT '=== active PI targets ===' AS x;
SELECT l.target_form_no,
       MAX(CASE WHEN ds.shr IS NOT NULL THEN 1 ELSE 0 END) audited,
       MAX(CASE WHEN ds.canceled='Y' THEN 1 ELSE 0 END) canceled,
       MAX(CASE WHEN ds.saved='Y' THEN 1 ELSE 0 END) saved
FROM form_flow_link l LEFT JOIN yj_doc_status ds ON ds.panel_code='PURCHASE_IN' AND ds.doc_no=l.target_form_no
WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN' AND l.link_status='ACTIVE'
GROUP BY l.target_form_no ORDER BY 1;
GO
SELECT '=== PI rows ===' AS x;
SELECT h.单据编号,h.单据日期,h.单据状态,h.审核人,h.审核时间,h.供应商,h.来源单号,h.批次号
FROM bd_purchase_in h WHERE h.单据编号 IN (SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE') ORDER BY h.单据编号;
GO
SELECT '=== active TC targets ===' AS x;
SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE';
GO
SELECT '=== QC_CATALOG field list ===' AS x;
SELECT label,col_name,place,seq,data_type,editable,required,visible,hidden,dict_sql FROM yj_field WHERE panel_code='QC_CATALOG' ORDER BY place,seq,id;
GO
SELECT '=== QC_INSP_REC field list ===' AS x;
SELECT label,col_name,place,seq,data_type,editable,required,visible,hidden,dict_sql FROM yj_field WHERE panel_code='QC_INSP_REC' ORDER BY place,seq,id;
GO
SELECT '=== QC_INSP dict fields ===' AS x;
SELECT label,col_name,place,seq,data_type,dict_sql FROM yj_field WHERE panel_code='QC_INSP' AND (dict_sql IS NOT NULL AND dict_sql<>'') ORDER BY seq;
GO
SELECT '=== QC_RETURN field list ===' AS x;
SELECT label,col_name,place,seq,data_type,editable,required,visible,hidden FROM yj_field WHERE panel_code='QC_RETURN' ORDER BY place,seq,id;
GO
