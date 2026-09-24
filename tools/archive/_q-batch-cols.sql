SET NOCOUNT ON;
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' THEN 1 ELSE 0 END) AS 有批次号,
       SUM(CASE WHEN ISNULL(批号,'')<>'' THEN 1 ELSE 0 END) AS 有批号,
       SUM(CASE WHEN ISNULL(批次号,'')<>'' AND ISNULL(批号,'')='' THEN 1 ELSE 0 END) AS 仅批次号有值
  FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 5 单据编号, 存货名称, 批次号, 批号 FROM bl_purchase_in WHERE ISNULL(批次号,'')<>'' AND ISNULL(批号,'')='' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
