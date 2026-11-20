SELECT h.id,h.[单据编号],h.[单据日期],h.[产品编号],h.[产品名称],s.doc_no,s.saved,s.archived,s.pending,s.update_at
FROM rd_prod_info_head h LEFT JOIN yj_doc_status s ON s.doc_no=h.[单据编号] AND s.panel_code='RD_PROD_INFO'
WHERE h.[产品编号]='B-46-10-1' OR h.[单据编号] IN ('PI-2026-11-0022','PI-2026-11-0023','PI-2026-11-0024')
ORDER BY h.id DESC
