SET NOCOUNT ON;
GO
SELECT l.target_form_no AS 特采单, l.source_form_no AS 检验单, t.总数量,
       (SELECT COUNT(*) FROM form_flow_link x WHERE x.source_panel_code='QC_TC_IN' AND x.source_form_no=l.target_form_no AND x.target_panel_code='PURCHASE_IN' AND x.link_status='ACTIVE') AS 已生入库,
       (SELECT ISNULL(s.pending,'N') FROM yj_doc_status s WHERE s.panel_code='QC_TC_IN' AND s.doc_no=l.target_form_no) AS pending,
       (SELECT ISNULL(s.shr,'') FROM yj_doc_status s WHERE s.panel_code='QC_TC_IN' AND s.doc_no=l.target_form_no) AS shr
FROM form_flow_link l JOIN qc_tc_in t ON t.单据编号 = l.target_form_no
WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_TC_IN' AND l.link_status='ACTIVE'
ORDER BY l.target_form_no;
GO
