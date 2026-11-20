SELECT h.id,h.[单据编号],h.[产品编号],h.[标题],s.saved,s.pending
FROM rd_insp_plan_head h LEFT JOIN yj_doc_status s ON s.doc_no=h.[单据编号] AND s.panel_code='RD_INSP_PLAN'
WHERE h.[产品编号] IN ('B-46-09-1','A-48-36','B-46-13','B-46-10-1')
ORDER BY h.id
