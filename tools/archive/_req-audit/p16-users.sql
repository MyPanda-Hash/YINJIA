SET NOCOUNT ON;
PRINT N'=== yj_user 账号清单 ===';
SELECT username, real_name, is_admin, role_id, enabled FROM yj_user ORDER BY is_admin DESC, username;
GO
PRINT N'=== 含 冯 的账号 ===';
SELECT username, real_name, is_admin FROM yj_user WHERE real_name LIKE N'%冯%' OR username LIKE N'%feng%';
GO
PRINT N'=== rd_dev_task 行数 ===';
SELECT COUNT(*) AS n FROM rd_dev_task;
GO
PRINT N'=== 各 RD 业务表行数(方案进度快照) ===';
SELECT 'rd_spec_doc_head' AS t, COUNT(*) AS n FROM rd_spec_doc_head
UNION ALL SELECT 'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT 'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT 'rd_dom_test_head', COUNT(*) FROM rd_dom_test_head
UNION ALL SELECT 'rd_prod_info_head', COUNT(*) FROM rd_prod_info_head
UNION ALL SELECT 'rd_plan', COUNT(*) FROM rd_plan
UNION ALL SELECT 'rd_approval', COUNT(*) FROM rd_approval
UNION ALL SELECT 'rd_progress', COUNT(*) FROM rd_progress
UNION ALL SELECT 'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT 'rd_filter_eff_head', COUNT(*) FROM rd_filter_eff_head;
GO
PRINT N'=== 规格书分发表(spec_assign)是否存在 ===';
SELECT name FROM sys.tables WHERE name LIKE '%assign%' OR name LIKE '%spec%';
GO
PRINT N'=== yj_form_approval 动作分布 ===';
SELECT action, result, COUNT(*) AS n FROM yj_form_approval GROUP BY action, result ORDER BY n DESC;
