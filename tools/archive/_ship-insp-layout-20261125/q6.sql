SELECT 单据编号, 单据状态, 总结论, 检验员, 表单审核人, 内部批次清单 FROM qc_asm_insp_head WHERE 单据编号='ZJ-2026-11-0012';
SELECT 单据编号, 单据状态, 审批状态 FROM yj_doc_status WHERE 单据编号='ZJ-2026-11-0012';
SELECT 审核人, 审核时间 FROM qc_asm_insp_head WHERE 单据编号='ZJ-2026-11-0012';
SELECT id, 结果判断, 检验结果 FROM qc_asm_insp_detail WHERE 单据编号='ZJ-2026-11-0012' ORDER BY 行号;
