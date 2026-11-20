SELECT h.id,h.[单据编号],h.[单据日期],h.[产品编号],[标题],[客户项目名称],h.[管理人],h.[版本号],h.[密级],h.[使用范围],h.[编写人],h.[审核人],s.saved,s.archived,s.pending,s.update_at
FROM rd_insp_plan_head h LEFT JOIN yj_doc_status s ON s.doc_no=h.[单据编号] AND s.panel_code='RD_INSP_PLAN'
WHERE h.[单据编号]='IP-2026-11-0018'
