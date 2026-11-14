-- 验收造数清理(测试库 HSDZ_MES_TEST):
--   1) B4 巡线验收单 XJ-2026-11-0003(本次验收建)
--   2) A1 勾选式点击取证时点「新增」产生的空草稿 SJ-2026-11-0009
-- 保留:XJ-2026-11-0001/0002(实现方 patrol-sheet 的测试数据,不属本次验收,留给 Lead 处理)
SELECT 'BEFORE patrol head' AS chk, 单据编号, 单据日期, asp_time1 FROM qc_line_patrol_head
WHERE 单据编号 = 'XJ-2026-11-0003';

SELECT 'BEFORE patrol detail' AS chk, COUNT(*) AS n FROM qc_line_patrol_detail WHERE 单据编号 = 'XJ-2026-11-0003';

SELECT 'BEFORE firstinsp head' AS chk, 单据编号, 工单号, asp_time1 FROM qc_first_insp_head
WHERE 单据编号 = 'SJ-2026-11-0009';

DELETE FROM qc_line_patrol_detail WHERE 单据编号 = 'XJ-2026-11-0003';

DELETE FROM qc_line_patrol_head WHERE 单据编号 = 'XJ-2026-11-0003';

DELETE FROM yj_doc_status WHERE panel_code = 'QC_LINE_PATROL' AND doc_no = 'XJ-2026-11-0003';

DELETE FROM qc_first_insp_detail WHERE 单据编号 = 'SJ-2026-11-0009';

DELETE FROM qc_first_insp_head WHERE 单据编号 = 'SJ-2026-11-0009';

DELETE FROM yj_doc_status WHERE panel_code = 'QC_FIRST_INSP' AND doc_no = 'SJ-2026-11-0009';

SELECT 'AFTER patrol' AS chk, COUNT(*) AS n FROM qc_line_patrol_head WHERE 单据编号 = 'XJ-2026-11-0003';

SELECT 'AFTER patrol detail' AS chk, COUNT(*) AS n FROM qc_line_patrol_detail WHERE 单据编号 = 'XJ-2026-11-0003';

SELECT 'AFTER firstinsp' AS chk, COUNT(*) AS n FROM qc_first_insp_head WHERE 单据编号 = 'SJ-2026-11-0009';

SELECT 'KEPT patrol heads' AS chk, 单据编号 FROM qc_line_patrol_head ORDER BY 单据编号;
