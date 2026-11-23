SET NOCOUNT ON;
SELECT panel_code+'|'+col_name+'|'+label+'|'+data_type+'|'+place+'|'+CAST(seq AS varchar(10))+'|hid'+CAST(hidden AS varchar(2)) AS r
FROM yj_field WHERE panel_code IN (N'RD_SAMPLE_EXT',N'RD_SAMPLE_ND') ORDER BY panel_code, place, seq;
GO
