SET NOCOUNT ON;
SELECT 'bd_so_order 最大asp_time1' AS 项, MAX(asp_time1) AS 本地 FROM HSDZ_MES.dbo.bd_so_order UNION ALL SELECT 'bd_so_order 最大asp_time1', MAX(asp_time1) FROM HSDZ_MES_SRV1017.dbo.bd_so_order;
SELECT 'yj_usage_log 最大created_at', MAX(created_at) FROM HSDZ_MES.dbo.yj_usage_log UNION ALL SELECT 'yj_usage_log', MAX(created_at) FROM HSDZ_MES_SRV1017.dbo.yj_usage_log;
SELECT 'yj_doc_status 最大update_at', MAX(update_at) FROM HSDZ_MES.dbo.yj_doc_status UNION ALL SELECT 'yj_doc_status', MAX(update_at) FROM HSDZ_MES_SRV1017.dbo.yj_doc_status;
SELECT 'scjl 最大asp_time1', MAX(asp_time1) FROM HSDZ_MES.dbo.scjl UNION ALL SELECT 'scjl', MAX(asp_time1) FROM HSDZ_MES_SRV1017.dbo.scjl;
SELECT 'bs_inv 最大ERP更新时间', MAX(ERP更新时间) FROM HSDZ_MES.dbo.bs_inv UNION ALL SELECT 'bs_inv', MAX(ERP更新时间) FROM HSDZ_MES_SRV1017.dbo.bs_inv;
SELECT 'form_flow_link 最大create_time', MAX(create_time) FROM HSDZ_MES.dbo.form_flow_link UNION ALL SELECT 'form_flow_link', MAX(create_time) FROM HSDZ_MES_SRV1017.dbo.form_flow_link;
