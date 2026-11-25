UPDATE yj_doc_status SET shr=N'冯敏', shsj=GETDATE(), pending='N', update_at=GETDATE() WHERE panel_code='QC_ASM_INSP' AND doc_no='ZJ-2026-11-0012';
SELECT panel_code, doc_no, shr, pending, canceled FROM yj_doc_status WHERE doc_no='ZJ-2026-11-0012';
