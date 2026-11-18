SELECT id, doc_no, canceled, saved, update_at, archived_at, shr, shsj FROM yj_doc_status WHERE id=34235;
SELECT 行序, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel FROM bs_asm_bom WHERE 单据编号='C-23-11_V0001' ORDER BY 行序;
SELECT TOP 20 action, panel_code, doc_no, operator, create_time FROM yj_form_approval WHERE panel_code IN ('ASM_BOM','RD_ASM_PROC') ORDER BY id DESC;
