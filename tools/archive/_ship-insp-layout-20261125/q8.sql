SELECT TOP 10 s.doc_no, s.shr, s.shsj, h.内部批次清单
FROM yj_doc_status s LEFT JOIN qc_asm_insp_head h ON h.单据编号=s.doc_no
WHERE s.panel_code='QC_ASM_INSP' AND s.shr IS NOT NULL AND s.canceled IS NULL
ORDER BY s.id DESC;
SELECT TOP 5 单据编号, 行号, 检验项目, 内部批次, 结果判断, 检验结果 FROM qc_asm_insp_detail WHERE 内部批次 IS NOT NULL AND 内部批次 <> '' ORDER BY id DESC;
