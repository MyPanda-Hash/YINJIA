SELECT
  (SELECT COUNT(*) FROM dbo.qc_proc_insp_head  WHERE ISNULL(asp_cancel,N'N')<>'Y') AS 制程_剩余,
  (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,N'N')<>'Y') AS 首件_剩余,
  (SELECT COUNT(*) FROM _bak_qcdraft_proc_head_20261021) AS 制程_快照,
  (SELECT COUNT(*) FROM _bak_qcdraft_fst_head_20261021)  AS 首件_快照
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
)
SELECT
  SUM(CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
           THEN 1 ELSE 0 END) AS 制程_草稿剩余,
  SUM(CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
                AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
                AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
                     AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'' OR ISNULL(x.[不良数量],0)>0))
           THEN 1 ELSE 0 END) AS 制程_空壳草稿剩余
FROM dbo.qc_proc_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
)
SELECT
  SUM(CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
           THEN 1 ELSE 0 END) AS 首件_草稿剩余,
  SUM(CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
                AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[生产日期],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
                AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
                     AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N''))
           THEN 1 ELSE 0 END) AS 首件_空壳草稿剩余
FROM dbo.qc_first_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
GO
SELECT ISNULL(s.shr,N'<null>') AS shr, COUNT(*) AS 张数
FROM dbo.qc_proc_insp_head hh LEFT JOIN dbo.yj_doc_status s ON s.panel_code=N'QC_PROC_INSP' AND s.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y' GROUP BY ISNULL(s.shr,N'<null>') ORDER BY COUNT(*) DESC
GO
SELECT ISNULL(s.shr,N'<null>') AS shr, COUNT(*) AS 张数
FROM dbo.qc_first_insp_head hh LEFT JOIN dbo.yj_doc_status s ON s.panel_code=N'QC_FIRST_INSP' AND s.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y' GROUP BY ISNULL(s.shr,N'<null>') ORDER BY COUNT(*) DESC
GO
