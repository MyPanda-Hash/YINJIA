WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
),
h AS (
  SELECT hh.[单据编号] AS no, hh.[工单号] AS wo, hh.[产品编码] AS dm, hh.[检验员] AS jy, hh.[批次号] AS lot,
         ISNULL(hh.[报工数量],0) AS bg,
         (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl
  FROM dbo.qc_proc_insp_head hh WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
),
v AS (
  SELECT h.*, CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                        AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                        AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                        AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft
  FROM h LEFT JOIN st ON st.doc_no=h.no
)
SELECT
  COUNT(*) AS 全部,
  SUM(is_draft) AS 草稿,
  SUM(CASE WHEN is_draft=1 AND ISNULL(wo,N'')=N'' AND ISNULL(dm,N'')=N'' AND ISNULL(jy,N'')=N''
                AND ISNULL(lot,N'')=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS 草稿_完全空壳,
  SUM(CASE WHEN is_draft=1 AND ISNULL(wo,N'')=N'' AND ISNULL(jy,N'')=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS 草稿_无工单无检验员无报工无明细,
  SUM(CASE WHEN is_draft=1 AND dl=0 AND bg=0 THEN 1 ELSE 0 END) AS 草稿_无明细无报工,
  SUM(CASE WHEN is_draft=1 AND dl>0 THEN 1 ELSE 0 END) AS 草稿_有明细,
  SUM(CASE WHEN is_draft=1 AND bg>0 THEN 1 ELSE 0 END) AS 草稿_有报工数量
FROM v
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
),
h AS (
  SELECT hh.[单据编号] AS no, hh.[工单号] AS wo, hh.[产品编码] AS dm, hh.[检验员] AS jy, hh.[批次号] AS lot,
         ISNULL(hh.[生产日期],N'') AS pd, ISNULL(hh.[报工数量],0) AS bg,
         (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl
  FROM dbo.qc_first_insp_head hh WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
),
v AS (
  SELECT h.*, CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                        AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                        AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                        AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft
  FROM h LEFT JOIN st ON st.doc_no=h.no
)
SELECT
  COUNT(*) AS 全部,
  SUM(is_draft) AS 草稿,
  SUM(CASE WHEN is_draft=1 AND ISNULL(wo,N'')=N'' AND ISNULL(dm,N'')=N'' AND ISNULL(jy,N'')=N''
                AND ISNULL(lot,N'')=N'' AND pd=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS 草稿_完全空壳,
  SUM(CASE WHEN is_draft=1 AND ISNULL(wo,N'')=N'' AND ISNULL(jy,N'')=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS 草稿_无工单无检验员无报工无明细,
  SUM(CASE WHEN is_draft=1 AND dl=0 AND bg=0 THEN 1 ELSE 0 END) AS 草稿_无明细无报工,
  SUM(CASE WHEN is_draft=1 AND dl>0 THEN 1 ELSE 0 END) AS 草稿_有明细,
  SUM(CASE WHEN is_draft=1 AND bg>0 THEN 1 ELSE 0 END) AS 草稿_有报工数量
FROM v
GO
