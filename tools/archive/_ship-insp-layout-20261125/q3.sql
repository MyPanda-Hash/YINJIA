SELECT TOP 6 id, 单据编号, 批次号, 内部批次清单, 总结论, 表单审核人, 检验员, 单据状态 FROM qc_asm_insp_head ORDER BY id DESC;
SELECT COUNT(*) AS zj0015 FROM qc_asm_insp_head WHERE 单据编号='ZJ-2026-11-0015';
SELECT TOP 12 id, 单据编号, 行号, 检验项目, 检验要求, 检验方法, 内部批次, 结果判断, 检验结果, 实测数值 FROM qc_asm_insp_detail WHERE 单据编号=(SELECT TOP 1 单据编号 FROM qc_asm_insp_head ORDER BY id DESC) ORDER BY 行号;
