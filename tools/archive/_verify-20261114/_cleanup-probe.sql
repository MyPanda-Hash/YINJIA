SELECT TOP 5 id, 单据编号, 工单号, 单据日期, asp_time1 FROM qc_first_insp_head ORDER BY id DESC;
SELECT TOP 8 id, 单据编号, 工单号, 单据日期, asp_time1 FROM qc_first_insp_head WHERE 工单号 IS NULL ORDER BY id DESC;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_doc_status' ORDER BY ORDINAL_POSITION;
SELECT TOP 5 * FROM yj_doc_status WHERE doc_no LIKE 'SJ-2026-11-001%' OR doc_no LIKE 'XJ-2026-11-000%';
