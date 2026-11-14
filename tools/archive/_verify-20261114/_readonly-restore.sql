UPDATE yj_doc_status SET shr = NULL, shsj = NULL WHERE panel_code = 'QC_LINE_PATROL' AND doc_no = 'XJ-2026-11-0001';
SELECT 'RESTORED' AS chk, panel_code, doc_no, shr, shsj FROM yj_doc_status WHERE panel_code='QC_LINE_PATROL' AND doc_no='XJ-2026-11-0001';
