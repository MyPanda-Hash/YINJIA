SET NOCOUNT ON;
GO
SELECT N'qc_insp_detail 单位列' AS 项, COL_LENGTH('dbo.qc_insp_detail', N'单位') AS 值;
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_insp_detail') AND name IN (N'单位', N'计量单位', N'送检数量');
GO
