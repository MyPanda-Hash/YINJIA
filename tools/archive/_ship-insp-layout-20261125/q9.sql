INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, pending, update_at)
SELECT 'QC_ASM_INSP', 'ZJ-2026-11-0012', N'冯敏', GETDATE(), 0, GETDATE()
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code='QC_ASM_INSP' AND doc_no='ZJ-2026-11-0012');
UPDATE qc_asm_insp_head SET 审核人=N'冯敏', 审核时间=GETDATE() WHERE 单据编号='ZJ-2026-11-0012';
SELECT doc_no, shr, pending, canceled FROM yj_doc_status WHERE doc_no='ZJ-2026-11-0012';
