SELECT COUNT(*) AS heads FROM qc_asm_insp_head WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS dets FROM qc_asm_insp_detail WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS st FROM yj_doc_status WHERE doc_no IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS trail FROM yj_form_approval WHERE doc_no IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
