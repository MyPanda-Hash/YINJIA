SELECT 单据编号, 产品编号, 产品名称, 版本号, 单据日期 FROM rd_asm_proc_head WHERE 单据编号='AP-2026-11-0001';
SELECT 表区, COUNT(*) n FROM rd_asm_proc_detail WHERE 单据编号='AP-2026-11-0001' GROUP BY 表区;
SELECT doc_no, canceled, saved, update_at FROM yj_doc_status WHERE doc_no='AP-2026-11-0001' AND panel_code='RD_ASM_PROC';
