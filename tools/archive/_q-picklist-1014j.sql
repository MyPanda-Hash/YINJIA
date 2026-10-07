-- _q-picklist-1014j.sql — 探针 v10:PLANG 是否登记为面板 + form_flow_link 里的 PLANG 占用实况(只读)
SET NOCOUNT ON;
PRINT '=== 1) yj_panel 里是否有 PLANG ===';
SELECT panel_code, panel_name, mode, line_table, head_table, group_col, pk_col, prefix FROM yj_panel WHERE panel_code IN (N'PLANG', N'MANU_SCHEDULE', N'LINE_LOAD');
PRINT '=== 2) form_flow_link 里 PLANG 相关占用 ===';
SELECT source_panel_code, target_panel_code, COUNT(*) AS 行数 FROM form_flow_link GROUP BY source_panel_code, target_panel_code ORDER BY 3 DESC;
PRINT '=== 3) MATERIAL_OUT 相关占用样例 ===';
SELECT TOP 10 * FROM form_flow_link WHERE target_panel_code = N'MATERIAL_OUT';
