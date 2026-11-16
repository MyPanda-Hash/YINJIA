SELECT TOP 6 panel_code, doc_no, shr, shsj, saved, archived FROM yj_doc_status WHERE shr IS NOT NULL AND shr <> '' ORDER BY id DESC;
SELECT panel_code, doc_no, shr, shsj FROM yj_doc_status WHERE panel_code='QC_LINE_PATROL';
