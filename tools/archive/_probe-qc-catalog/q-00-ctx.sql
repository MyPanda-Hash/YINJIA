-- q-00-ctx.sql — 检验目录面板实施前探针:面板前缀/近名面板/译名现值/RD_PROGRESS 注册形态
SET NOCOUNT ON;
SELECT 'A.前缀占用' AS k, prefix, panel_code, panel_name FROM yj_panel WHERE prefix IN (N'JYML', N'ML', N'CAT') OR panel_code IN (N'QC_CATALOG', N'QC_DIR', N'QC_ML');
SELECT 'B.含检验/目录的面板' AS k, panel_code, panel_name, category, mode, line_table, head_table, module_group, CONVERT(nvarchar(100), config) AS config FROM yj_panel WHERE panel_name LIKE N'%检验%' OR panel_name LIKE N'%目录%';
SELECT 'C.RD_PROGRESS注册' AS k, panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, CONVERT(nvarchar(100), config) AS config FROM yj_panel WHERE panel_code = N'RD_PROGRESS';
SELECT 'D.RD_PROGRESS字段' AS k, col_name, label, data_type, place, seq, editable, required, hidden, visible FROM yj_field WHERE panel_code = N'RD_PROGRESS' ORDER BY CASE place WHEN N'query' THEN 0 WHEN N'header' THEN 1 ELSE 2 END, seq;
SELECT 'E.译名现值' AS k, scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'检验目录', N'检测物料类别', N'物料名称', N'批次号', N'数量', N'检验状态', N'是否合格', N'正在检验中', N'已完成检验', N'合格', N'不合格') AND locale = N'en' ORDER BY scope, ref_key;
SELECT 'F.列名占用' AS k, 'qc_catalog' AS tbl, COUNT(*) AS exists_cols FROM sys.columns WHERE object_id = OBJECT_ID('qc_catalog');
