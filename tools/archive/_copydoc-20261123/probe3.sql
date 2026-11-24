SET NOCOUNT ON;
SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code IN (N'RD_APPROVAL',N'RD_PROD_INFO',N'RD_SAMPLE_EXT',N'RD_SAMPLE_ND') GROUP BY panel_code;
GO
SELECT panel_code, col_name, label, data_type, place, seq, visible, hidden, required
FROM yj_field WHERE panel_code = N'RD_PROD_INFO' ORDER BY place, seq
OFFSET 47 ROWS;
GO
