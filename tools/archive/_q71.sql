SET NOCOUNT ON;
SELECT N'销售出库' AS 面板, (SELECT COUNT(*) FROM bd_sale_out) AS 头, (SELECT COUNT(*) FROM bl_sale_out) AS 行;
