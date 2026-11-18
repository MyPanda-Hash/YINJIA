SET NOCOUNT ON;
PRINT '--- A. 混料配方快照行数 ---';
SELECT N'wo_mixing_head' AS 表, COUNT(*) AS 行数 FROM wo_mixing_head
UNION ALL SELECT N'wo_mixing_detail', COUNT(*) FROM wo_mixing_detail;
PRINT '--- B. 混料快照样例 ---';
SELECT TOP 5 * FROM wo_mixing_head;
SELECT TOP 10 * FROM wo_mixing_detail;
PRINT '--- C. 含「物料清单/配方」的面板 ---';
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel
WHERE panel_name LIKE N'%物料清单%' OR panel_name LIKE N'%配方%' ORDER BY panel_code;
