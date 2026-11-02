WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
),
v AS (
  SELECT hh.[单据编号] AS no,
         CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                   AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                   AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                   AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft,
         CASE WHEN ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
                   AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
                   AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号])
              THEN 1 ELSE 0 END AS is_empty
  FROM dbo.qc_proc_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号] WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
)
SELECT
  (SELECT COUNT(*) FROM v WHERE is_draft=1 AND is_empty=1) AS 制程_空壳草稿,
  (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号] IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 制程_空壳明细行,
  (SELECT COUNT(*) FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP' AND s.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 制程_状态行,
  (SELECT COUNT(*) FROM dbo.yj_form_approval a WHERE a.panel_code=N'QC_PROC_INSP' AND a.form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 制程_审批行,
  (SELECT COUNT(*) FROM dbo.form_flow_link l WHERE (l.source_panel_code=N'QC_PROC_INSP' AND l.source_form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) OR (l.target_panel_code=N'QC_PROC_INSP' AND l.target_form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1))) AS 制程_占用链,
  (SELECT COUNT(*) FROM dbo.yj_doc_annotation n WHERE n.panel_code=N'QC_PROC_INSP' AND n.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 制程_批注,
  (SELECT COUNT(*) FROM dbo.yj_usage_log u WHERE u.panel_name=N'QC_PROC_INSP' AND u.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 制程_留痕
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
),
v AS (
  SELECT hh.[单据编号] AS no,
         CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                   AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                   AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                   AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft,
         CASE WHEN ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
                   AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[生产日期],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
                   AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号])
              THEN 1 ELSE 0 END AS is_empty
  FROM dbo.qc_first_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号] WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
)
SELECT
  (SELECT COUNT(*) FROM v WHERE is_draft=1 AND is_empty=1) AS 首件_空壳草稿,
  (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号] IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 首件_空壳明细行,
  (SELECT COUNT(*) FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP' AND s.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 首件_状态行,
  (SELECT COUNT(*) FROM dbo.yj_form_approval a WHERE a.panel_code=N'QC_FIRST_INSP' AND a.form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 首件_审批行,
  (SELECT COUNT(*) FROM dbo.form_flow_link l WHERE (l.source_panel_code=N'QC_FIRST_INSP' AND l.source_form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) OR (l.target_panel_code=N'QC_FIRST_INSP' AND l.target_form_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1))) AS 首件_占用链,
  (SELECT COUNT(*) FROM dbo.yj_doc_annotation n WHERE n.panel_code=N'QC_FIRST_INSP' AND n.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 首件_批注,
  (SELECT COUNT(*) FROM dbo.yj_usage_log u WHERE u.panel_name=N'QC_FIRST_INSP' AND u.doc_no IN (SELECT no FROM v WHERE is_draft=1 AND is_empty=1)) AS 首件_留痕
GO
