-- q-01-ctx.sql — 检验数据记录面板实施前探针:面板名/前缀/表名/库码占用
SET NOCOUNT ON;
SELECT 'A.近名面板' AS k, panel_code, panel_name, mode, head_table, line_table, module_group FROM yj_panel WHERE panel_name LIKE N'%检验%' OR panel_name LIKE N'%记录%';
SELECT 'B.前缀占用' AS k, panel_code, prefix FROM yj_panel WHERE prefix IN (N'JYSJ', N'JYJL', N'JYBG');
SELECT 'C.表/库码占用' AS k, 'qc_insp_rec' AS obj, COUNT(*) AS n FROM sys.tables WHERE name = 'qc_insp_rec'
UNION ALL SELECT 'C.表/库码占用', 'qc_insp_rec_detail', COUNT(*) FROM sys.tables WHERE name = 'qc_insp_rec_detail'
UNION ALL SELECT 'C.表/库码占用', 'lib:qc.insp_item', COUNT(*) FROM yj_std_lib WHERE lib_code = N'qc.insp_item';
SELECT 'D.标准库维护面板' AS k, panel_code, panel_name FROM yj_panel WHERE panel_name LIKE N'%标准库%';
