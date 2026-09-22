SET NOCOUNT ON;
SELECT 'bs_wh' AS k, c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('bs_wh') ORDER BY c.column_id;
GO
SELECT 'kucun 关键列' AS k, c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('kucun') AND c.name IN (N'id',N'asp_cancel',N'kucun_no') ORDER BY c.column_id;
GO
