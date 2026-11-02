WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
)
SELECT hh.[单据编号] AS no, ISNULL(hh.[工单号],N'') AS wo, ISNULL(hh.[产品编码],N'') AS dm,
       ISNULL(hh.[检验员],N'') AS jy, ISNULL(hh.[批次号],N'') AS lot, ISNULL(hh.[报工数量],0) AS bg,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
          AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'' OR ISNULL(x.[不良数量],0)>0)) AS dl_filled,
       CONVERT(varchar(19), hh.asp_time1, 120) AS 建单
FROM dbo.qc_proc_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
  AND ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
  AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y' AND ISNULL(st.archived,'N')<>'Y'
  AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
ORDER BY hh.[单据编号] DESC
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
)
SELECT hh.[单据编号] AS no, ISNULL(hh.[工单号],N'') AS wo, ISNULL(hh.[产品编码],N'') AS dm,
       ISNULL(hh.[检验员],N'') AS jy, ISNULL(hh.[批次号],N'') AS lot, ISNULL(hh.[生产日期],N'') AS pd,
       ISNULL(hh.[报工数量],0) AS bg,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]) AS dl,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]
          AND (ISNULL(x.[实测数值],N'')<>N'' OR ISNULL(x.[结果判断],N'')<>N'')) AS dl_filled,
       CONVERT(varchar(19), hh.asp_time1, 120) AS 建单
FROM dbo.qc_first_insp_head hh LEFT JOIN st ON st.doc_no=hh.[单据编号]
WHERE ISNULL(hh.asp_cancel,'N')<>'Y'
  AND ISNULL(st.shr,'')=N'' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
  AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y' AND ISNULL(st.archived,'N')<>'Y'
  AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
  AND NOT (ISNULL(hh.[工单号],N'')=N'' AND ISNULL(hh.[产品编码],N'')=N'' AND ISNULL(hh.[检验员],N'')=N''
           AND ISNULL(hh.[批次号],N'')=N'' AND ISNULL(hh.[生产日期],N'')=N'' AND ISNULL(hh.[报工数量],0)=0
           AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=hh.[单据编号]))
ORDER BY hh.[单据编号] DESC
GO
