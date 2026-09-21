USE HSDZ_MES; SET NOCOUNT ON;
SELECT panel_code, place, seq, col_name, label, data_type, required, ISNULL(dict_sql,N'') AS dict_sql
FROM yj_field
WHERE col_name LIKE N'%等级%' OR label LIKE N'%等级%' OR col_name LIKE N'%定级%' OR label LIKE N'%定级%'
   OR col_name LIKE N'%层级%' OR label LIKE N'%层级%'
ORDER BY panel_code, place, seq;
GO
SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code IN (N'RD_APPROVAL', N'RD_PLAN', N'RD_PROGRESS') GROUP BY panel_code;
GO