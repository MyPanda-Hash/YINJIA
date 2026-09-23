SET NOCOUNT ON;
PRINT '=== 1. 面板总数 / 字段总数 ===';
SELECT (SELECT COUNT(*) FROM yj_panel) AS panels, (SELECT COUNT(*) FROM yj_field) AS fields;
PRINT '=== 2. 按模块分组 ===';
SELECT module_group, COUNT(*) AS cnt FROM yj_panel GROUP BY module_group ORDER BY cnt DESC;
PRINT '=== 3. 研发管理面板 ===';
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE module_group = N'研发管理' ORDER BY panel_code;
PRINT '=== 4. 供应链/仓库面板 ===';
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE module_group IN (N'智能供应链', N'仓库管理', N'生产制造') ORDER BY module_group, panel_code;
PRINT '=== 5. 关键需求字段扫描 ===';
SELECT f.panel_code, p.panel_name, p.module_group, f.label, f.col_name, f.data_type, f.visible
FROM yj_field f LEFT JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.label LIKE N'%预设库位%' OR f.col_name LIKE N'%预设库位%' OR f.col_name LIKE N'%preset%'
   OR f.label LIKE N'%批次%' OR f.col_name LIKE N'%lot%'
   OR f.label LIKE N'%检验结果%' OR f.col_name LIKE N'%inspectresult%'
   OR f.label LIKE N'%文件编码%' OR f.col_name LIKE N'%文件编码%'
   OR f.label LIKE N'%受控%' OR f.col_name LIKE N'%受控%' OR f.col_name LIKE N'%controlled%'
   OR f.label LIKE N'%公差%' OR f.col_name LIKE N'%公差%'
   OR f.label LIKE N'%库位%' OR f.col_name LIKE N'%库位%'
   OR f.label LIKE N'%二维码%' OR f.col_name LIKE N'%qrcode%'
   OR f.label LIKE N'%特采%' OR f.col_name LIKE N'%特采%'
   OR f.label LIKE N'%客供%'
   OR f.label LIKE N'%履历%'
   OR f.label LIKE N'%定级%' OR f.label LIKE N'%等级%'
ORDER BY p.module_group, f.panel_code, f.label;
