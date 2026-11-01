IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
IF OBJECT_ID('tempdb..#f') IS NOT NULL DROP TABLE #f;
CREATE TABLE #p (no nvarchar(100) NOT NULL PRIMARY KEY);
CREATE TABLE #f (no nvarchar(100) NOT NULL PRIMARY KEY);

INSERT INTO #p (no)
SELECT hh.[单据编号]
FROM dbo.qc_proc_insp_head hh
LEFT JOIN dbo.yj_doc_status s ON s.panel_code=N'QC_PROC_INSP' AND s.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
  AND ISNULL(s.shr,'')=N'' AND ISNULL(s.pending,'N')<>'Y' AND ISNULL(s.canceled,'N')<>'Y'
  AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.archived,'N')<>'Y'
  AND ISNULL(s.modify_state,'N')<>'Y' AND ISNULL(s.effective,'N')<>'Y'
  AND ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
  AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
                    AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'' OR ISNULL(x.[不良数量],0)>0));

INSERT INTO #f (no)
SELECT hh.[单据编号]
FROM dbo.qc_first_insp_head hh
LEFT JOIN dbo.yj_doc_status s ON s.panel_code=N'QC_FIRST_INSP' AND s.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
  AND ISNULL(s.shr,'')=N'' AND ISNULL(s.pending,'N')<>'Y' AND ISNULL(s.canceled,'N')<>'Y'
  AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.archived,'N')<>'Y'
  AND ISNULL(s.modify_state,'N')<>'Y' AND ISNULL(s.effective,'N')<>'Y'
  AND ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
  AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[生产日期],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
                    AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N''));

SELECT
  (SELECT COUNT(*) FROM #p) AS 制程_候选,
  (SELECT COUNT(*) FROM #f) AS 首件_候选,
  (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail WHERE [单据编号] IN (SELECT no FROM #p)) AS 制程_明细行,
  (SELECT COUNT(*) FROM dbo.qc_first_insp_detail WHERE [单据编号] IN (SELECT no FROM #f)) AS 首件_明细行,
  (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code=N'QC_PROC_INSP' AND doc_no IN (SELECT no FROM #p)) AS 制程_状态行,
  (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code=N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f)) AS 首件_状态行,
  (SELECT COUNT(*) FROM dbo.yj_form_approval WHERE (panel_code=N'QC_PROC_INSP' AND form_no IN (SELECT no FROM #p)) OR (panel_code=N'QC_FIRST_INSP' AND form_no IN (SELECT no FROM #f))) AS 审批行,
  (SELECT COUNT(*) FROM dbo.form_flow_link WHERE (source_panel_code=N'QC_PROC_INSP' AND source_form_no IN (SELECT no FROM #p)) OR (target_panel_code=N'QC_PROC_INSP' AND target_form_no IN (SELECT no FROM #p)) OR (source_panel_code=N'QC_FIRST_INSP' AND source_form_no IN (SELECT no FROM #f)) OR (target_panel_code=N'QC_FIRST_INSP' AND target_form_no IN (SELECT no FROM #f))) AS 占用链,
  (SELECT COUNT(*) FROM dbo.yj_doc_batch WHERE (target_panel_code=N'QC_PROC_INSP' AND target_form_no IN (SELECT no FROM #p)) OR (target_panel_code=N'QC_FIRST_INSP' AND target_form_no IN (SELECT no FROM #f))) AS 批次台账,
  (SELECT COUNT(*) FROM dbo.yj_attachment WHERE (panel_code=N'QC_PROC_INSP' AND doc_no IN (SELECT no FROM #p)) OR (panel_code=N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f))) AS 附件,
  (SELECT COUNT(*) FROM dbo.yj_doc_annotation WHERE (panel_code=N'QC_PROC_INSP' AND doc_no IN (SELECT no FROM #p)) OR (panel_code=N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f))) AS 批注,
  (SELECT COUNT(*) FROM dbo.yj_usage_log WHERE (panel_name=N'QC_PROC_INSP' AND doc_no IN (SELECT no FROM #p)) OR (panel_name=N'QC_FIRST_INSP' AND doc_no IN (SELECT no FROM #f))) AS 留痕
GO
