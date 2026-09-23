-- _q-change2.sql —— 部门与账号映射 + RD_CHANGE 字段清单
SET NOCOUNT ON;
SELECT d.id, d.parent_id, d.dept_name, d.sort FROM yj_dept d ORDER BY d.sort, d.id;
GO
SELECT u.username, u.real_name, u.is_admin, u.enabled, u.dept_id, d.dept_name
  FROM yj_user u LEFT JOIN yj_dept d ON d.id = u.dept_id
 ORDER BY u.is_admin DESC, u.username;
GO
SELECT f.label, f.col_name, f.data_type, f.place, f.seq, f.required, f.editable, f.ref_panel IS NOT NULL AS has_ref, f.dict_sql IS NOT NULL AS has_dict
  FROM yj_field f WHERE f.panel_code = 'RD_CHANGE' ORDER BY f.place, f.seq;
GO
SELECT panel_code, panel_name, category, head_table, line_table, group_col, prefix, place FROM yj_panel WHERE panel_code = 'RD_CHANGE';
GO
