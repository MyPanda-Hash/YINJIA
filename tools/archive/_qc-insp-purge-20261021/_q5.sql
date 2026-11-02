WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
),
d AS (
  SELECT h.[单据编号] AS no, h.[工单号], h.[产品编码], h.[产品名称], h.[检验员], h.[检验类别], h.[批次号],
         ISNULL(h.[报工数量],0) AS 报工数量,
         (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=h.[单据编号]) AS 明细行数,
         (SELECT ISNULL(SUM(ISNULL(x.[不合格数量],0)),0) FROM dbo.qc_proc_insp_detail x WHERE x.[单据编号]=h.[单据编号]) AS 不合格合计
  FROM dbo.qc_proc_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
)
SELECT
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
           THEN 1 ELSE 0 END) AS 草稿数,
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND ISNULL(d.[工单号],N'')=N'' AND ISNULL(d.[产品编码],N'')=N''
                AND ISNULL(d.[检验员],N'')=N'' AND ISNULL(d.[批次号],N'')=N''
                AND d.报工数量=0 AND d.明细行数=0
           THEN 1 ELSE 0 END) AS 草稿_全空,
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND (ISNULL(d.[工单号],N'')<>N'' OR ISNULL(d.[产品编码],N'')<>N'' OR ISNULL(d.[检验员],N'')<>N''
                     OR ISNULL(d.[批次号],N'')<>N'' OR d.报工数量>0 OR d.明细行数>0)
           THEN 1 ELSE 0 END) AS 草稿_有内容
FROM d
LEFT JOIN st ON st.doc_no = d.no
GO
WITH st AS (
  SELECT s.doc_no, s.shr, s.pending, s.canceled, s.stopped, s.deleting, s.archived, s.modify_state, s.effective
  FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_FIRST_INSP'
),
d AS (
  SELECT h.[单据编号] AS no, h.[工单号], h.[产品编码], h.[产品名称], h.[检验员], h.[批次号], h.[生产日期],
         ISNULL(h.[报工数量],0) AS 报工数量,
         (SELECT COUNT(*) FROM dbo.qc_first_insp_detail x WHERE x.[单据编号]=h.[单据编号]) AS 明细行数
  FROM dbo.qc_first_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
)
SELECT
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
           THEN 1 ELSE 0 END) AS 草稿数,
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND ISNULL(d.[工单号],N'')=N'' AND ISNULL(d.[产品编码],N'')=N''
                AND ISNULL(d.[检验员],N'')=N'' AND ISNULL(d.[批次号],N'')=N''
                AND ISNULL(d.[生产日期],N'')=N'' AND d.报工数量=0 AND d.明细行数=0
           THEN 1 ELSE 0 END) AS 草稿_全空,
  SUM(CASE WHEN ISNULL(st.shr,'')='' AND ISNULL(st.pending,'N')<>'Y' AND ISNULL(st.canceled,'N')<>'Y'
                AND ISNULL(st.stopped,'N')<>'Y' AND ISNULL(st.deleting,'N')<>'Y'
                AND ISNULL(st.archived,'N')<>'Y' AND ISNULL(st.modify_state,'N')<>'Y' AND ISNULL(st.effective,'N')<>'Y'
                AND (ISNULL(d.[工单号],N'')<>N'' OR ISNULL(d.[产品编码],N'')<>N'' OR ISNULL(d.[检验员],N'')<>N''
                     OR ISNULL(d.[批次号],N'')<>N'' OR ISNULL(d.[生产日期],N'')<>N'' OR d.报工数量>0 OR d.明细行数>0)
           THEN 1 ELSE 0 END) AS 草稿_有内容
FROM d
LEFT JOIN st ON st.doc_no = d.no
GO
