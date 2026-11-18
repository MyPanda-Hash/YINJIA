SELECT panel_code, doc_no, archived, shr, pending, update_at, archived_at FROM yj_doc_status WHERE panel_code='RD_ASM_PROC' AND CONVERT(date, update_at) >= '2026-11-18' ORDER BY update_at DESC;
SELECT 单据编号, 产品编码, 版本号, 默认BOM, 来源, 状态, COUNT(*) OVER (PARTITION BY 单据编号) AS rows_per_doc FROM bs_asm_bom WHERE 产品编码 IN ('C-23-11','A-48-41','B-92-25') ORDER BY 单据编号, 行序;
SELECT 单据编号, 产品编号, 版本号 FROM rd_asm_proc_head WHERE 单据编号='AP-2026-10-0006';
