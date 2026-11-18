SELECT 'ap_nov' t, COUNT(*) n FROM rd_asm_proc_head WHERE 单据编号 LIKE 'AP-2026-11-%' UNION ALL
SELECT 'mp_nov', COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-11-%' UNION ALL
SELECT 'xs_any', COUNT(*) FROM rd_x_sinter_head UNION ALL
SELECT 'mix_rows', COUNT(*) FROM bs_mix_bom UNION ALL
SELECT 'asm_rows', COUNT(*) FROM bs_asm_bom UNION ALL
SELECT 'c23', COUNT(*) FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' UNION ALL
SELECT 'e2e_asm', COUNT(*) FROM bs_asm_bom WHERE 产品编码 LIKE 'E2E%' UNION ALL
SELECT 'status_left', COUNT(*) FROM yj_doc_status WHERE doc_no IN ('AP-2026-11-0001','AP-2026-11-0002','MP-2026-11-0001','XS-2026-11-0001') UNION ALL
SELECT 'appr_left', COUNT(*) FROM yj_form_approval WHERE form_no IN ('AP-2026-11-0001','AP-2026-11-0002','MP-2026-11-0001','XS-2026-11-0001')
