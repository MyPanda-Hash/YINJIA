SELECT 'ap_head' t, COUNT(*) n FROM rd_asm_proc_head WHERE 单据编号 LIKE 'AP-2026-11-%' UNION ALL
SELECT 'ap_dtl', COUNT(*) FROM rd_asm_proc_detail WHERE 单据编号 LIKE 'AP-2026-11-%' UNION ALL
SELECT 'mp_head', COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-11-%' UNION ALL
SELECT 'mp_dtl', COUNT(*) FROM rd_mold_proc_detail WHERE 单据编号 LIKE 'MP-2026-11-%' UNION ALL
SELECT 'xs_head', COUNT(*) FROM rd_x_sinter_head WHERE 单据编号 LIKE 'XS-2026-11-%' UNION ALL
SELECT 'xs_dtl', COUNT(*) FROM rd_x_sinter_detail WHERE 单据编号 LIKE 'XS-2026-11-%' UNION ALL
SELECT 'status', COUNT(*) FROM yj_doc_status WHERE doc_no IN ('AP-2026-11-0001','AP-2026-11-0002','MP-2026-11-0001','XS-2026-11-0001') UNION ALL
SELECT 'approval', COUNT(*) FROM yj_form_approval WHERE 单据编号 IN ('AP-2026-11-0001','AP-2026-11-0002','MP-2026-11-0001','XS-2026-11-0001') UNION ALL
SELECT 'modifylog', COUNT(*) FROM yj_doc_modify_log WHERE doc_no IN ('AP-2026-11-0001','AP-2026-11-0002','MP-2026-11-0001','XS-2026-11-0001');
SELECT TOP 5 单据编号, 产品编号 FROM rd_asm_proc_head WHERE 单据编号 LIKE 'AP-2026-11-%';
SELECT TOP 5 单据编号, 产品编号 FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-11-%';
SELECT TOP 5 单据编号, 产品编号 FROM rd_x_sinter_head WHERE 单据编号 LIKE 'XS-2026-11-%';
