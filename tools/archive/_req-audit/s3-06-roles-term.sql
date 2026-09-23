SET NOCOUNT ON;
GO
SELECT N'=== A. yj_role 角色清单 ===' AS hdr;
GO
SELECT * FROM yj_role;
GO
SELECT N'=== B. yj_role_panel 中 RD_* 的审批权(can_approve) ===' AS hdr;
GO
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_role_panel' ORDER BY ORDINAL_POSITION;
GO
SELECT * FROM yj_role_panel WHERE panel_code LIKE 'RD%' ORDER BY panel_code, role_id;
GO
SELECT N'=== C. yj_role_panel 全量(看有哪些角色/面板/权限位) ===' AS hdr;
GO
SELECT COUNT(*) AS total_rows FROM yj_role_panel;
GO
SELECT TOP 50 * FROM yj_role_panel ORDER BY panel_code, role_id;
GO
SELECT N'=== D. yj_field 里含"审核/批准/负责人/审批"的 RD 字段 ===' AS hdr;
GO
SELECT panel_code, col_name, label, data_type, place, seq, editable, visible
FROM yj_field WHERE panel_code LIKE 'RD%'
  AND (label LIKE N'%审核%' OR label LIKE N'%批准%' OR label LIKE N'%负责人%' OR label LIKE N'%审批%')
ORDER BY panel_code, seq;
GO
SELECT N'=== E. rd_plan 是否有终止/版本/状态相关列 ===' AS hdr;
GO
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_plan'
  AND (COLUMN_NAME LIKE N'%终止%' OR COLUMN_NAME LIKE N'%版本%' OR COLUMN_NAME LIKE N'%状态%' OR COLUMN_NAME LIKE N'%审%');
GO
SELECT N'=== F. 所有含"终止/版本"列的表 ===' AS hdr;
GO
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%终止%' OR COLUMN_NAME LIKE N'%版本%'
ORDER BY TABLE_NAME, COLUMN_NAME;
GO
SELECT N'=== G. yj_translation 中 scope=field 的全部 RD 相关译名(看覆盖语言) ===' AS hdr;
GO
SELECT ref_key, locale, text FROM yj_translation
WHERE scope='field' AND ref_key IN (N'项目定级', N'项目层级', N'项目名称', N'项目级', N'测试内容', N'测试员')
ORDER BY ref_key, locale;
GO
SELECT N'=== H. yj_translation 里 locale 全集 ===' AS hdr;
GO
SELECT locale, COUNT(*) AS cnt FROM yj_translation GROUP BY locale ORDER BY locale;
GO
