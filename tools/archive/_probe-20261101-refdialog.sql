SET NOCOUNT ON;
PRINT '=== ① 参照「档案(archive)面板」的字段(受本次回归影响) ===';
SELECT f.panel_code AS 本方面板, p.panel_name AS 本方名称, f.label AS 字段, f.ref_panel AS 参照面板, r.panel_name AS 参照名称
FROM yj_field f JOIN yj_panel r ON r.panel_code = f.ref_panel JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE r.mode = 'archive' AND f.data_type = N'参照'
ORDER BY f.ref_panel, f.panel_code;
PRINT '=== ② 参照 singleDoc 单据面板(展平明细行)的字段 ===';
SELECT f.panel_code AS 本方面板, f.label AS 字段, f.ref_panel AS 参照面板, r.mode AS 参照模式, r.config
FROM yj_field f JOIN yj_panel r ON r.panel_code = f.ref_panel
WHERE f.data_type = N'参照' AND r.mode = 'doc' AND ISNULL(r.config,'') LIKE '%singleDoc%'
ORDER BY f.ref_panel;
PRINT '=== ③ 档案面板总数 / 其中 visible 字段数 ===';
SELECT p.panel_code, COUNT(f.id) AS 可见字段数 FROM yj_panel p JOIN yj_field f ON f.panel_code=p.panel_code AND f.visible=1
WHERE p.mode='archive' GROUP BY p.panel_code ORDER BY p.panel_code;
