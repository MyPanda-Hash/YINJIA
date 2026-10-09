/* _probe-pu-print-default.sql — 采购订单「打印」相关按钮与面板配置取证(一次性探针)
   目的:确认 PU_ORDER 工具栏上打印类按钮有哪些、哪个在前(默认点哪个),以及面板 config 里的打印旗标。 */

SET NOCOUNT ON;

PRINT '=== [1] yj_button 列结构 ===';
SELECT c.name AS 列名, t.name AS 类型
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('yj_button') ORDER BY c.column_id;
GO

PRINT '=== [2] PU_ORDER 全部按钮(按显示顺序)==='; 
SELECT * FROM yj_button WHERE panel_code = N'PU_ORDER' ORDER BY seq;
GO

PRINT '=== [3] 全库打印类按钮名(哪些面板有「打印」/「打印*」按钮)==='; 
SELECT panel_code, button_name, seq FROM yj_button
WHERE button_name LIKE N'%打印%' ORDER BY panel_code, seq;
GO

PRINT '=== [4] PU_ORDER 面板行 ==='; 
SELECT * FROM yj_panel WHERE panel_code = N'PU_ORDER';
GO
