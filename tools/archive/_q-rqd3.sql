SET NOCOUNT ON;
GO
SELECT panel_code, CASE WHEN ISNULL(config,'') LIKE N'%reportQueryDialog%' THEN N'有' ELSE N'无' END AS 有标记
  FROM yj_panel WHERE panel_code LIKE N'STOCK%';
GO
