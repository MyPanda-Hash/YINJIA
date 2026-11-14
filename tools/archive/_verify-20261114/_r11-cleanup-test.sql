-- 第十一轮补验造数清理(测试库 HSDZ_MES_TEST):只删本轮验收建的 SJ-2026-11-0010
-- 该单 = 「选生产工单」生成的草稿,填 挤压强度 5#=32.5 后保存;90 行明细;单据日期 2026-11-15
SELECT 'BEFORE head' AS chk, 单据编号, 工单号, 单据日期, asp_time1 FROM qc_first_insp_head WHERE 单据编号='SJ-2026-11-0010';

SELECT 'BEFORE detail' AS chk, COUNT(*) AS n FROM qc_first_insp_detail WHERE 单据编号='SJ-2026-11-0010';

SELECT 'BEFORE doc_status' AS chk, panel_code, doc_no FROM yj_doc_status WHERE doc_no='SJ-2026-11-0010';

DELETE FROM qc_first_insp_detail WHERE 单据编号='SJ-2026-11-0010';

DELETE FROM qc_first_insp_head WHERE 单据编号='SJ-2026-11-0010';

DELETE FROM yj_doc_status WHERE panel_code='QC_FIRST_INSP' AND doc_no='SJ-2026-11-0010';

SELECT 'AFTER head' AS chk, COUNT(*) AS n FROM qc_first_insp_head WHERE 单据编号='SJ-2026-11-0010';

SELECT 'AFTER detail' AS chk, COUNT(*) AS n FROM qc_first_insp_detail WHERE 单据编号='SJ-2026-11-0010';

SELECT 'AFTER doc_status' AS chk, COUNT(*) AS n FROM yj_doc_status WHERE doc_no='SJ-2026-11-0010';

SELECT 'REMAIN top3' AS chk, 单据编号 FROM (SELECT TOP 3 单据编号 FROM qc_first_insp_head ORDER BY id DESC) t;
