-- _q-picklist-1014i.sql — 探针 v9:领用人参照(EMP)/仓库(WH)(只读)
SET NOCOUNT ON;
PRINT '=== 0) yj_panel 列名 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;
PRINT '=== 1) EMP / WH 面板行 ===';
SELECT * FROM yj_panel WHERE panel_code IN (N'EMP', N'WH');
PRINT '=== 2) 员工档案(前 10) ===';
SELECT TOP 10 * FROM bs_emp ORDER BY id;
PRINT '=== 3) yj_user 账号与姓名 ===';
SELECT TOP 15 username, real_name FROM yj_user ORDER BY id;
PRINT '=== 4) 仓库档案(前 15) ===';
SELECT TOP 15 * FROM bs_wh ORDER BY id;
