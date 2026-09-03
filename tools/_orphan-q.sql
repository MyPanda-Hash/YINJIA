SET NOCOUNT ON;
-- 1) 已删业务单据面板(RKD/CKD/CGD/KHDD/WLBOM)相关表/视图
SELECT 'TABLE' AS k, name FROM sys.tables WHERE name LIKE '%rkd%' OR name LIKE '%ckd%' OR name LIKE '%cgd%' OR name LIKE '%khdd%' OR name LIKE '%wlbom%' OR name LIKE '%_bom%'
UNION ALL SELECT 'VIEW', name FROM sys.views WHERE name LIKE '%rkd%' OR name LIKE '%ckd%' OR name LIKE '%cgd%' OR name LIKE '%khdd%' OR name LIKE '%wlbom%';
GO
-- 2) 未被任何 yj_panel 引用、非 yj_ 前缀的表(孤儿/旧系统表)
SELECT t.name FROM sys.tables t
WHERE t.name NOT LIKE 'yj[_]%'
  AND t.name NOT IN (SELECT line_table FROM yj_panel WHERE line_table IS NOT NULL)
  AND t.name NOT IN (SELECT head_table FROM yj_panel WHERE head_table IS NOT NULL)
  AND t.name NOT LIKE 'v[_]%'
ORDER BY t.name;
GO
-- 3) yj_field.ref_panel 指向不存在的面板 + 字段所属面板不存在
SELECT DISTINCT f.panel_code, f.ref_panel FROM yj_field f WHERE f.ref_panel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code=f.ref_panel);
GO
-- 4) 孤儿状态/审批记录(单据主数据不存在)
SELECT 'doc_status' AS k, COUNT(*) AS n FROM yj_doc_status s WHERE NOT EXISTS (SELECT 1 FROM yj_panel p JOIN sys.tables t ON t.name=p.line_table WHERE p.panel_code=s.panel_code AND EXISTS (SELECT 1 FROM t WHERE 1=0));