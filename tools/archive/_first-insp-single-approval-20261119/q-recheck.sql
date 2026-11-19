SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 工单号, 产品编码, 检验员, 总结论, 审核人 FROM qc_first_insp_head WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013');
PRINT '--- detail counts';
SELECT 单据编号, COUNT(*) c, SUM(CASE WHEN 实测数值 IS NOT NULL AND 实测数值<>'' THEN 1 ELSE 0 END) filled FROM qc_first_insp_detail WHERE 单据编号 IN ('SJ-2026-11-0012','SJ-2026-11-0013') GROUP BY 单据编号;
PRINT '--- status';
SELECT doc_no, shr, archived, pending, approve_node FROM yj_doc_status WHERE doc_no IN ('SJ-2026-11-0012','SJ-2026-11-0013');
PRINT '--- trail';
SELECT panel_code, form_no, action, result, node_no, operator, opinion, create_time FROM yj_form_approval WHERE form_no IN ('SJ-2026-11-0012','SJ-2026-11-0013') ORDER BY id DESC;
