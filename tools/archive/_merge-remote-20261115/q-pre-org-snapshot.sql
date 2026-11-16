/* 迁移前快照(只读导出):当前面板 / 角色 / 面板授权 */
SELECT panel_code, panel_name, module_group FROM yj_panel ORDER BY panel_code;
SELECT id, role_code, role_name FROM yj_role ORDER BY id;
SELECT role_id, panel_code, can_approve, perms FROM yj_role_panel ORDER BY panel_code, role_id;
