WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
),
v AS (
  SELECT hh.[单据编号] AS no,
         ISNULL(hh.[工单号],N'') AS wo, ISNULL(hh.[产品编码],N'') AS dm, ISNULL(hh.[检验员],N'') AS jy,
         ISNULL(hh.[批次号],N'') AS lot, ISNULL(hh.[报工数量],0) AS bg,
         (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl,
         (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
            AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'' OR ISNULL(x.[不良数量],0)>0)) AS dl_filled,
         CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                   AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                   AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                   AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft
  FROM dbo.qc_proc_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
  WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
)
SELECT
  SUM(CASE WHEN is_draft=1 AND wo=N'' AND dm=N'' AND jy=N'' AND lot=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS A_完全空壳,
  SUM(CASE WHEN is_draft=1 AND dl>0 AND dl_filled=0 AND bg=0 THEN 1 ELSE 0 END) AS B_有明细行但一格没填,
  SUM(CASE WHEN is_draft=1 AND dl_filled>0 THEN 1 ELSE 0 END) AS C_明细填过,
  SUM(CASE WHEN is_draft=1 AND (wo<>N'' OR dm<>N'' OR jy<>N'' OR lot<>N'' OR bg>0) AND dl=0 THEN 1 ELSE 0 END) AS D_有表头无明细,
  SUM(is_draft) AS 草稿合计
FROM v
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
),
v AS (
  SELECT hh.[单据编号] AS no,
         ISNULL(hh.[工单号],N'') AS wo, ISNULL(hh.[产品编码],N'') AS dm, ISNULL(hh.[检验员],N'') AS jy,
         ISNULL(hh.[批次号],N'') AS lot, ISNULL(hh.[生产日期],N'') AS pd, ISNULL(hh.[报工数量],0) AS bg,
         (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl,
         (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
            AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'')) AS dl_filled,
         CASE WHEN ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                   AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                   AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y'
                   AND ISNULL(st.effective,'N')<>'Y' THEN 1 ELSE 0 END AS is_draft
  FROM dbo.qc_first_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
  WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
)
SELECT
  SUM(CASE WHEN is_draft=1 AND wo=N'' AND dm=N'' AND jy=N'' AND lot=N'' AND pd=N'' AND bg=0 AND dl=0 THEN 1 ELSE 0 END) AS A_完全空壳,
  SUM(CASE WHEN is_draft=1 AND dl>0 AND dl_filled=0 AND bg=0 THEN 1 ELSE 0 END) AS B_有明细行但一格没填,
  SUM(CASE WHEN is_draft=1 AND dl_filled>0 THEN 1 ELSE 0 END) AS C_明细填过,
  SUM(CASE WHEN is_draft=1 AND (wo<>N'' OR dm<>N'' OR jy<>N'' OR lot<>N'' OR pd<>N'' OR bg>0) AND dl=0 THEN 1 ELSE 0 END) AS D_有表头无明细,
  SUM(is_draft) AS 草稿合计
FROM v
GO
