SET NOCOUNT ON;
-- bs_inv 补计算列:是否来料检验 = 检验方式'1'→是(否则否);参照带回同名自动带出
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NULL
  ALTER TABLE dbo.bs_inv ADD [是否来料检验] AS CASE WHEN RTRIM(ISNULL(检验方式,'')) = '1' THEN N'是' ELSE N'否' END;
GO
IF NOT EXISTS(SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'是否来料检验')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('INV', N'是否来料检验', N'是否来料检验', N'文本', N'header', 45, 90, 0, 0, 1, 1);
GO
