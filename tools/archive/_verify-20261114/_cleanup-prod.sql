-- 验收造数清理(正式库 HSDZ_MES):本次验收在首件检验单里造的 3 张测试单
-- 单号来源:2 张 = 点「新增」建的空草稿(SJ-2026-11-0009/0010);1 张 = A2 真落库用单(SJ-2026-11-0011)
-- 只删这三个单号;不碰其它单据;号池已消耗的流水号不回退(正常业务行为)
SELECT 'BEFORE head' AS chk, 单据编号, 工单号, asp_time1 FROM qc_first_insp_head
WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011')
ORDER BY 单据编号;

SELECT 'BEFORE detail rows' AS chk, 单据编号, COUNT(*) AS n FROM qc_first_insp_detail
WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011')
GROUP BY 单据编号;

SELECT 'BEFORE doc_status' AS chk, panel_code, doc_no FROM yj_doc_status
WHERE doc_no IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

DELETE FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

DELETE FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

DELETE FROM yj_doc_status WHERE panel_code = 'QC_FIRST_INSP'
  AND doc_no IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

SELECT 'AFTER head' AS chk, COUNT(*) AS n FROM qc_first_insp_head
WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

SELECT 'AFTER detail' AS chk, COUNT(*) AS n FROM qc_first_insp_detail
WHERE 单据编号 IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

SELECT 'AFTER doc_status' AS chk, COUNT(*) AS n FROM yj_doc_status
WHERE doc_no IN ('SJ-2026-11-0009','SJ-2026-11-0010','SJ-2026-11-0011');

SELECT 'REMAIN top3' AS chk, 单据编号 FROM (SELECT TOP 3 单据编号 FROM qc_first_insp_head ORDER BY id DESC) t;
