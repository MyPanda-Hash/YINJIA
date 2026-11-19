SET NOCOUNT ON;
SELECT TOP 3 单据编号, 单据日期, 检验员, 总结论, 审核人, 审批人, 生产日期, 生产线 FROM qc_first_insp_head WHERE 单据编号='SJ-2026-11-0012';
PRINT '--- detail';
SELECT 行类型, 样品序号, 检验列, 标准, 实测数值 FROM qc_first_insp_detail WHERE 单据编号='SJ-2026-11-0012' AND 样品序号 IN ('3#','标准','4#') ORDER BY 行号;
PRINT '--- status';
SELECT panel_code, doc_no, shr, archived, pending, approve_node FROM yj_doc_status WHERE doc_no='SJ-2026-11-0012';
PRINT '--- approval cols';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_form_approval');
