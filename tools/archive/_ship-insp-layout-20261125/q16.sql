DELETE FROM qc_asm_insp_detail WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
DELETE FROM qc_asm_insp_head WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
DELETE FROM yj_doc_status WHERE doc_no IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS heads_left FROM qc_asm_insp_head WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS dets_left FROM qc_asm_insp_detail WHERE 单据编号 IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS st_left FROM yj_doc_status WHERE doc_no IN ('ZJ-2026-11-0012','ZJ-2026-11-0013');
SELECT COUNT(*) AS total_heads FROM qc_asm_insp_head;
