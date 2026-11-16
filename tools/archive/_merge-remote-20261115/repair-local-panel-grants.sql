/* repair:org 迁移(2026-11-11 服务器备份矩阵)会把 3 张本地新增面板的授权行删掉;
 * 本脚本按迁移前快照补回(role_id 在 org 脚本里按服务器 id 原样重灌,语义角色不变)。
 * 面板:SAMPLE_REG / INSP_COMMISSION / QC_LINE_PATROL —— 幂等。 */
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1025 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1025, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1026 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1026, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'INSP_COMMISSION', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1033 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1033, N'INSP_COMMISSION', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1037 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1037, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1039 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1039, N'INSP_COMMISSION', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1040 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1040, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1041 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1041, N'INSP_COMMISSION', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'INSP_COMMISSION')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'INSP_COMMISSION', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1025 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1025, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1026 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1026, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1033 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1033, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1037 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1037, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1039 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1039, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1040 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1040, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1041 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1041, N'QC_LINE_PATROL', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'QC_LINE_PATROL')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'QC_LINE_PATROL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1025 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1025, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1026 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1026, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1033 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1033, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1037 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1037, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1039 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1039, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1040 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1040, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1041 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1041, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'SAMPLE_REG')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'SAMPLE_REG', N'N', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
GO