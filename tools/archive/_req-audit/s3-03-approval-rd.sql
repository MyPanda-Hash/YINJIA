SET NOCOUNT ON;
GO
SELECT N'=== A. yj_form_approval 按 panel_code+action 分布 ===' AS hdr;
GO
SELECT panel_code, action, result, COUNT(*) AS cnt FROM yj_form_approval
GROUP BY panel_code, action, result ORDER BY panel_code, action;
GO
SELECT N'=== A2. yj_form_approval 中 RD_* 明细(全量<=50) ===' AS hdr;
GO
SELECT panel_code, form_no, action, result, node_no, operator, create_time
FROM yj_form_approval WHERE panel_code LIKE 'RD%' OR panel_code LIKE 'PLAN%'
ORDER BY create_time DESC;
GO
SELECT N'=== B. 研发管理面板(yj_panel) RD_ 全清单 ===' AS hdr;
GO
SELECT panel_code, panel_name, category, mode, line_table, head_table, module_group
FROM yj_panel WHERE panel_code LIKE 'RD%' ORDER BY panel_code;
GO
SELECT N'=== C. RD_* 单据在 yj_doc_status 的状态标记分布 ===' AS hdr;
GO
SELECT panel_code, COUNT(*) AS rows_total,
       SUM(CASE WHEN shr IS NOT NULL AND RTRIM(shr)<>'' THEN 1 ELSE 0 END) AS audited_shr,
       SUM(CASE WHEN RTRIM(canceled)='Y' THEN 1 ELSE 0 END) AS canceled,
       SUM(CASE WHEN RTRIM(pending)='Y' THEN 1 ELSE 0 END) AS pending_appr,
       SUM(CASE WHEN RTRIM(archived)='Y' THEN 1 ELSE 0 END) AS archived,
       SUM(CASE WHEN RTRIM(stopped)='Y' THEN 1 ELSE 0 END) AS stopped,
       SUM(CASE WHEN RTRIM(saved)='Y' THEN 1 ELSE 0 END) AS saved_y,
       SUM(CASE WHEN RTRIM(saved)='N' THEN 1 ELSE 0 END) AS saved_n,
       SUM(CASE WHEN modify_state IS NOT NULL THEN 1 ELSE 0 END) AS modify_state_notnull
FROM yj_doc_status WHERE panel_code LIKE 'RD%' GROUP BY panel_code ORDER BY panel_code;
GO
SELECT N'=== C2. RD_* modify_state 取值 ===' AS hdr;
GO
SELECT panel_code, RTRIM(modify_state) AS modify_state, COUNT(*) AS cnt
FROM yj_doc_status WHERE modify_state IS NOT NULL GROUP BY panel_code, modify_state;
GO
SELECT N'=== D. yj_panel 里 category/mode 取值全集 ===' AS hdr;
GO
SELECT category, mode, COUNT(*) AS cnt FROM yj_panel GROUP BY category, mode ORDER BY cnt DESC;
GO
