SET NOCOUNT ON;
PRINT N'=== 1. yj_role_panel 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_role_panel' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== 2. RD 面板的动作集(任取一个角色) ===';
SELECT TOP 60 * FROM yj_role_panel WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_DOM_TEST','RD_PROD_INFO','RD_FILTER_EFF') ORDER BY panel_code;
GO
PRINT N'=== 3. 动作词表里含 保存/提交/审核/受控 的 ===';
SELECT * FROM yj_role_panel WHERE CAST(actions AS NVARCHAR(MAX)) LIKE N'%保存%' AND panel_code LIKE 'RD%';
GO
PRINT N'=== 4. yj_role 清单 ===';
SELECT * FROM yj_role;
