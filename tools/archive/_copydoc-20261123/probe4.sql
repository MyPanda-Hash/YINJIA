SET NOCOUNT ON;
SELECT panel_code+'|'+col_name+'|'+label+'|'+data_type+'|'+place+'|'+CAST(seq AS varchar(10))+'|vis'+CAST(visible AS varchar(2))+'|hid'+CAST(hidden AS varchar(2))+'|req'+CAST(required AS varchar(2)) AS r
FROM yj_field WHERE panel_code = N'RD_PROD_INFO' ORDER BY place, seq;
GO
