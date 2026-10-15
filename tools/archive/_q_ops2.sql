SET NOCOUNT ON;
SELECT DISTINCT ISNULL(生产车间,N'(kong)') AS workshop FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY workshop;
SELECT panel_code, panel_name FROM dbo.yj_panel WHERE panel_code IN (N'MIX_RECORD',N'PACK_CONFIRM') OR panel_name LIKE N'%混合%' OR panel_name LIKE N'%封箱%';
