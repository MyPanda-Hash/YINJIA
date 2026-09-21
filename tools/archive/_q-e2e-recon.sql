SET NOCOUNT ON;
-- ① 现有账号与部门(判断"各部门账号"是否缺)
SELECT u.username, u.real_name, u.enabled, r.role_code, ISNULL(d.dept_name, N'(无部门)') AS dept
  FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id LEFT JOIN yj_dept d ON d.id = u.dept_id ORDER BY u.id;
GO
-- ② 现有产品信息表(挑/造测试产品)
SELECT TOP 10 单据编号, 产品编号, 产品名称, ISNULL(客户名称, N'-') AS 客户, ISNULL(asp_user1,'-') AS 制单
  FROM rd_prod_info_head ORDER BY id DESC;
GO
SELECT COUNT(*) AS prod_info_rows FROM rd_prod_info_head;
GO
-- ③ 产品信息表必填字段(照前端校验口径:required=1 且非系统字段)
SELECT label, data_type, place, required, hidden, ref_panel FROM yj_field
 WHERE panel_code = 'RD_PROD_INFO' AND place LIKE '%header%' ORDER BY seq;
GO
-- ④ 四文件现有单据数(看是否已有可用源单)
SELECT N'RD_MOLD_PROC' AS panel, COUNT(*) AS n FROM rd_mold_proc_head
UNION ALL SELECT N'RD_ASM_PROC', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'RD_SPEC_DOC', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'RD_INSP_PLAN', COUNT(*) FROM rd_insp_plan_head;
GO
-- ⑤ rd_dev_task 现状(责任人登记)
SELECT COUNT(*) AS dev_task_rows FROM rd_dev_task;
GO
