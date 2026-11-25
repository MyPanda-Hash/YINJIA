UPDATE qc_asm_insp_detail SET 结果判断=N'合格' WHERE 单据编号='ZJ-2026-11-0012';
UPDATE qc_asm_insp_head SET 总结论=N'合格', 处理方式=N'允收' WHERE 单据编号='ZJ-2026-11-0012';
UPDATE yj_doc_status SET shr=NULL, shsj=NULL WHERE panel_code='QC_ASM_INSP' AND doc_no='ZJ-2026-11-0012';
SELECT 行号, 结果判断, 检验结果 FROM qc_asm_insp_detail WHERE 单据编号='ZJ-2026-11-0012' ORDER BY 行号;
SELECT doc_no, shr, pending FROM yj_doc_status WHERE doc_no='ZJ-2026-11-0012';
