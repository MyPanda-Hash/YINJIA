SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 工单号, 产品编码, 检验员, 总结论 FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013');
PRINT '--- detail counts';
SELECT 单据编号, COUNT(*) c FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013') GROUP BY 单据编号;
PRINT '--- 0013 3# 外径';
SELECT 行号, 样品序号, 检验列, 实测数值 FROM qc_first_insp_detail WHERE 单据编号='SJ-2026-11-0013' AND 样品序号 IN ('3#','4#') ORDER BY 行号;
PRINT '--- status';
SELECT panel_code, doc_no, shr, archived, pending, approve_node FROM yj_doc_status WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
