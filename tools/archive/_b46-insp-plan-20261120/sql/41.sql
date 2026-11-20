SELECT h.id,h.[单据编号],h.[单据日期],h.[产品编号],h.[产品名称],s.[状态],s.asp_time1 AS st_time
FROM rd_prod_info_head h LEFT JOIN (SELECT * FROM yj_doc_status WHERE panel_code='RD_PROD_INFO') s ON s.[单据编号]=h.[单据编号]
WHERE h.[产品编号]='B-46-10-1' OR h.[单据编号] IN ('PI-2026-11-0022','PI-2026-11-0023','PI-2026-11-0024','PI-2026-11-0025')
ORDER BY h.id DESC
