SELECT 单据编号, 内部批次清单, 批次号, 总结论, 检验员, 表单审核人 FROM qc_asm_insp_head WHERE 单据编号='ZJ-2026-11-0012';
SELECT id, 行号, 检验项目, 检验要求, 检验方法, 内部批次, 结果判断, 检验结果, 实测数值 FROM qc_asm_insp_detail WHERE 单据编号='ZJ-2026-11-0012' ORDER BY 行号;
