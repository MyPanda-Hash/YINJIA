SET NOCOUNT ON;
PRINT N'=== A. 研发管理 22 面板字段数 ===';
SELECT p.panel_code, p.panel_name, (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code=p.panel_code) AS fields
FROM yj_panel p WHERE p.module_group=N'研发管理' ORDER BY p.panel_code;
GO
PRINT N'=== B. 检索含「管控/受控/规范/汇总/变更/履历/公差/编码」的面板名或字段标签 ===';
SELECT DISTINCT p.panel_code, p.panel_name, p.module_group
FROM yj_panel p
WHERE p.panel_name LIKE N'%管控%' OR p.panel_name LIKE N'%受控%' OR p.panel_name LIKE N'%规范%'
   OR p.panel_name LIKE N'%汇总%' OR p.panel_name LIKE N'%变更%' OR p.panel_name LIKE N'%履历%'
   OR p.panel_name LIKE N'%公差%' OR p.panel_name LIKE N'%编码规则%' OR p.panel_name LIKE N'%定型%'
ORDER BY p.panel_code;
GO
PRINT N'=== C. 字段标签含受控/履历/文件编码/管控/公差 的字段(跨全库) ===';
SELECT panel_code, col_name, label, place, seq, editable, hidden FROM yj_field
WHERE label LIKE N'%受控%' OR label LIKE N'%履历%' OR label LIKE N'%文件编码%'
   OR label LIKE N'%管控%' OR label LIKE N'%公差%' OR label LIKE N'%修订%'
   OR label LIKE N'%版本%' OR label LIKE N'%审核日期%'
ORDER BY panel_code, place, seq;
GO
PRINT N'=== D. 面板 config 含受控/变更/公差 的面板 ===';
SELECT panel_code, panel_name, LEFT(CAST(config AS NVARCHAR(MAX)), 300) AS cfg_head
FROM yj_panel
WHERE CAST(config AS NVARCHAR(MAX)) LIKE N'%受控%' OR CAST(config AS NVARCHAR(MAX)) LIKE N'%变更%'
   OR CAST(config AS NVARCHAR(MAX)) LIKE N'%公差%' OR CAST(config AS NVARCHAR(MAX)) LIKE N'%履历%'
ORDER BY panel_code;
