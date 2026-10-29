/* 只读:仓位档案 + 工单表字段 */
SET NOCOUNT ON;

PRINT N'== A. bs_wh_loc 列 ==';
SELECT c.name AS 列, ty.name AS 类型, c.max_length
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;

PRINT N'== B. bs_wh_loc 样本 ==';
SELECT TOP 6 * FROM dbo.bs_wh_loc;

PRINT N'== C. STOCK_PICK 面板登记 ==';
SELECT panel_code, panel_name, head_table, line_table FROM dbo.yj_panel WHERE panel_code = N'STOCK_PICK';

PRINT N'== D. plang 列(取前 40) ==';
SELECT TOP 40 c.name AS 列 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.plang') ORDER BY c.column_id;
