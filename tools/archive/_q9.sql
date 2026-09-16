SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM yj_field WHERE panel_code='SO_ORDER') AS SO面板
, (SELECT COUNT(*) FROM yj_field WHERE panel_code='PU_ORDER') AS PU面板
, (SELECT COUNT(*) FROM yj_field WHERE panel_code='KHDA') AS KHDA面板
, (SELECT COUNT(*) FROM yj_field WHERE panel_code='GFDA') AS GFDA面板
, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_so_order')) AS SO行表列
, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_pu_order')) AS PU行表列;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.dm_kh') AND name LIKE N'%联系人%' ORDER BY column_id;
SELECT TOP 2 单据编号, 存货编码, ISNULL(图片url,'') AS 图片, ISNULL(仓库编码,'') AS 仓库 FROM bl_so_order WHERE ISNULL(图片url,'')<>'' ORDER BY id DESC;
