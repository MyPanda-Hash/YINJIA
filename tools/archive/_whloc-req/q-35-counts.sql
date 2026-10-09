SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM bs_dict) AS 数据字典总行数,
       (SELECT CAST(CAST(page_size AS nvarchar(6)) AS nvarchar(6)) FROM yj_panel WHERE panel_code=N'ZDGL') AS 面板登记每页,
       (SELECT COUNT(*) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y') AS 仓位总行数,
       N'50/100/200/500' AS 可选每页;
GO