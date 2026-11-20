SET NOCOUNT ON;
SELECT 单据编号, 总结论, 单据状态, asp_user2, asp_time2 FROM qc_proc_insp_head WHERE 单据编号=N'ZC-2026-10-0131';
SELECT 单据编号, 总结论, 单据状态, asp_user2, asp_time2 FROM qc_asm_insp_head WHERE 单据编号=N'ZJ-2026-11-0007';
SELECT 'bhc_detail' k, COUNT(*) c FROM qc_bhc_detail WHERE 单据编号 IN (N'BHC-2026-11-0003',N'BHC-2026-11-0004')
UNION ALL SELECT 'doc_status', COUNT(*) FROM yj_doc_status WHERE doc_no IN (N'BHC-2026-11-0003',N'BHC-2026-11-0004')
UNION ALL SELECT 'approval', COUNT(*) FROM yj_form_approval WHERE doc_no IN (N'BHC-2026-11-0003',N'BHC-2026-11-0004');
