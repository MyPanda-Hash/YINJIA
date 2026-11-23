SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, place, seq, visible, hidden, required, alias
FROM yj_field
WHERE panel_code IN (N'RD_APPROVAL',N'RD_PROD_INFO',N'RD_SAMPLE_EXT',N'RD_SAMPLE_ND')
ORDER BY panel_code, seq;
GO
