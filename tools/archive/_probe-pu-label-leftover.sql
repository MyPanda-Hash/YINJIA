SET NOCOUNT ON;
GO
PRINT '=== 测试账套:是否还有存活的材料码打印记录(探针清理核对,应为 0) ===';
SELECT COUNT(*) AS 存活打印单 FROM bd_pu_label WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
SELECT COUNT(*) AS 存活打印行 FROM bl_pu_label WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
PRINT '=== 正式账套同口径(应也为 0)===';
SELECT COUNT(*) AS 存活打印单 FROM HSDZ_MES.dbo.bd_pu_label WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
