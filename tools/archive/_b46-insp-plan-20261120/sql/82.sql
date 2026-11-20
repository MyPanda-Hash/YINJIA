SELECT h.id, h.[单据编号], h.[单据日期], h.[产品编号], h.[标题], ISNULL(s.saved,'-') AS saved, ISNULL(s.pending,'-') AS pending,
  (SELECT COUNT(*) FROM rd_insp_plan_detail d WHERE d.[单据编号]=h.[单据编号] AND d.[表区]='检验项目') AS items
FROM rd_insp_plan_head h
LEFT JOIN yj_doc_status s ON s.doc_no=h.[单据编号] AND s.panel_code='RD_INSP_PLAN'
WHERE h.[单据日期]='2026-11-20'
ORDER BY h.id
