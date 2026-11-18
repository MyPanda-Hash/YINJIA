SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, place, seq FROM yj_field WHERE data_type=N'时间区间';
GO
