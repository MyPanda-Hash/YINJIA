SELECT COUNT(*) AS total FROM qc_asm_insp_head;
SELECT TOP 8 id, 编号, 批次号, 内部批次清单, 总结论, 表单审核人, 检验结果, 检验员 FROM qc_asm_insp_head ORDER BY id DESC;
SELECT id, 编号 FROM qc_asm_insp_head WHERE 编号 LIKE '%0015%';
