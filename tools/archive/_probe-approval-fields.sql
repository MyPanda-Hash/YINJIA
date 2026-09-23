USE HSDZ_MES; SET NOCOUNT ON;
SELECT place, seq, col_name, label, data_type, required, editable, visible, hidden, ISNULL(ref_panel,N'') AS ref_panel, ISNULL(ref_field,N'') AS ref_field, ISNULL(dict_sql,N'') AS dict_sql
FROM yj_field WHERE panel_code = N'RD_APPROVAL' ORDER BY place, seq;
GO
SELECT place, seq, col_name, label, data_type, required, ISNULL(ref_panel,N'') AS ref_panel, ISNULL(ref_field,N'') AS ref_field, ISNULL(dict_sql,N'') AS dict_sql
FROM yj_field WHERE panel_code = N'RD_PLAN' AND (col_name LIKE N'%定级%' OR col_name LIKE N'%文档编号%' OR col_name LIKE N'%名称%' OR col_name LIKE N'%立项%' OR ref_panel IS NOT NULL)
ORDER BY place, seq;
GO