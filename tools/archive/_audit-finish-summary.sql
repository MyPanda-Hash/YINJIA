SET NOCOUNT ON;
SELECT COUNT(*) AS finish_active FROM bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS finish_approved FROM bd_finish_in f JOIN yj_doc_status s ON s.panel_code='FINISH_IN' AND s.doc_no=f.[单据编号] WHERE ISNULL(f.asp_cancel,'N')<>'Y' AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y';
SELECT COUNT(*) AS finish_with_contract FROM bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([加工单号],N'')<>N'';
SELECT COUNT(*) AS finish_contract_no_plang FROM bd_finish_in f WHERE ISNULL(f.asp_cancel,'N')<>'Y' AND ISNULL(f.[加工单号],N'')<>N'' AND NOT EXISTS (SELECT 1 FROM plang p WHERE p.pl_no=f.[加工单号] AND ISNULL(p.asp_cancel,'N')<>'Y');
SELECT f.[单据编号] AS finish_no,f.[加工单号] AS work_no,f.[工单行号] AS work_line,f.[批次号] AS batch,s.gldh AS report_work,s.[报工单号] AS report_no,s.post_no AS report_post
FROM bd_finish_in f LEFT JOIN scjl s ON s.gldh=f.[加工单号] AND ISNULL(s.asp_cancel,'N')<>'Y'
WHERE ISNULL(f.asp_cancel,'N')<>'Y' AND ISNULL(f.[加工单号],N'')<>N'';
