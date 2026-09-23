SET NOCOUNT ON;
GO
SELECT N'S1-20: yj_doc_status 各 RD 面板状态分布(派生)' AS sec,
       panel_code,
       COUNT(*) AS 总数,
       SUM(CASE WHEN canceled='Y' THEN 1 ELSE 0 END) AS 已作废,
       SUM(CASE WHEN stopped='Y' THEN 1 ELSE 0 END) AS 已中止,
       SUM(CASE WHEN deleting='Y' THEN 1 ELSE 0 END) AS 删除申请中,
       SUM(CASE WHEN modify_state='R' THEN 1 ELSE 0 END) AS 修改申请中,
       SUM(CASE WHEN modify_state='Y' THEN 1 ELSE 0 END) AS 修改中,
       SUM(CASE WHEN pending='Y' THEN 1 ELSE 0 END) AS 审批中,
       SUM(CASE WHEN archived='Y' THEN 1 ELSE 0 END) AS 已归档,
       SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) AS 有审核人,
       SUM(CASE WHEN shr IS NULL AND ISNULL(canceled,'N')<>'Y' AND ISNULL(pending,'N')<>'Y' AND ISNULL(archived,'N')<>'Y' AND ISNULL(saved,'N')='Y' THEN 1 ELSE 0 END) AS 草稿_已保存,
       SUM(CASE WHEN ISNULL(saved,'N')='N' THEN 1 ELSE 0 END) AS 草稿_未保存,
       MAX(shsj) AS 最近审核时间
FROM yj_doc_status
WHERE panel_code LIKE 'RD%'
GROUP BY panel_code
ORDER BY panel_code;
GO
SELECT N'S1-21: 四个受控文件面板逐一统计' AS sec, panel_code, doc_no, shr, shsj, archived, pending, canceled, saved
FROM yj_doc_status
WHERE panel_code IN ('RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_ASM_BOM','RD_PROD_INFO','RD_MOLD_PROC')
ORDER BY panel_code, doc_no;
GO
SELECT N'S1-22: 四个受控文件业务表实际行数' AS sec, 'rd_spec_doc_head' AS tbl, COUNT(*) AS n FROM rd_spec_doc_head
UNION ALL SELECT N'S1-22', 'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'S1-22', 'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'S1-22', 'rd_asm_bom_head', COUNT(*) FROM rd_asm_bom_head
UNION ALL SELECT N'S1-22', 'rd_prod_info_head', COUNT(*) FROM rd_prod_info_head
UNION ALL SELECT N'S1-22', 'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head;
GO
SELECT N'S1-23: yj_role_panel 中 RD_ 面板的 perms/can_approve' AS sec, role_id, panel_code, perms, can_approve
FROM yj_role_panel WHERE panel_code LIKE 'RD%' ORDER BY panel_code, role_id;
GO
