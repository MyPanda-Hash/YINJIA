SELECT N'剩余检验委托单' AS k, COUNT(*) AS n FROM dbo.qc_insp_commission_head
UNION ALL SELECT N'剩余委托单行', COUNT(*) FROM dbo.qc_insp_commission_detail
UNION ALL SELECT N'剩余审批留痕', COUNT(*) FROM dbo.yj_form_approval WHERE panel_code = N'INSP_COMMISSION'
UNION ALL SELECT N'剩余单据状态', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'INSP_COMMISSION'
UNION ALL SELECT N'送样登记表存活行', COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y'
UNION ALL SELECT N'送样登记表总行', COUNT(*) FROM dbo.qc_sample_reg;
