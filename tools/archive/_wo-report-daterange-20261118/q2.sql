SET NOCOUNT ON;
SELECT data_type, COUNT(*) AS n FROM yj_field GROUP BY data_type ORDER BY n DESC;
GO
SELECT panel_code, col_name, label, data_type, place FROM yj_field WHERE data_type=N'数值' ORDER BY panel_code, seq;
GO
SELECT panel_code, col_name, label, data_type, place FROM yj_field WHERE label IN (N'开始日期',N'结束日期') ORDER BY panel_code, seq;
GO
