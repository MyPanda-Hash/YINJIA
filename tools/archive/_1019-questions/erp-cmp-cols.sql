SET NOCOUNT ON;
GO
PRINT '=== bl_purchase_in 关键列 ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_purchase_in')
  AND name IN (N'仓库编码', N'仓库名称', N'仓库', N'单位id', N'批号', N'批次号', N'源单行号', N'存货编码', N'计量单位', N'税率%', N'实收数量', N'单价')
ORDER BY name;
GO
PRINT '=== bl_purchase_in 全列 ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_purchase_in') ORDER BY column_id;
GO
PRINT '=== bd_other_out / bd_other_in 头列(对照:其他出库单怎么拿到仓库/部门) ==='
GO
SELECT OBJECT_NAME(object_id) AS 表, name FROM sys.columns
WHERE object_id IN (OBJECT_ID('dbo.bd_other_out'), OBJECT_ID('dbo.bd_other_in'))
  AND (name LIKE N'%仓库%' OR name LIKE N'%ERP%' OR name LIKE N'%部门%' OR name LIKE N'%业务类型%')
ORDER BY 表, name;
GO
PRINT '=== qc_insp 头关键列(退回单的上游) ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_insp')
  AND (name LIKE N'%供应商%' OR name LIKE N'%仓库%' OR name LIKE N'%采购订单%' OR name LIKE N'%批次%')
ORDER BY name;
GO
PRINT '=== qc_recv 头关键列(送料暂收单编码口径) ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_recv')
  AND (name LIKE N'%供应商%' OR name LIKE N'%仓库%' OR name LIKE N'%采购订单%' OR name LIKE N'%批次%')
ORDER BY name;
GO
PRINT '=== qc_return.供应商(名称) 能否解析到 bs_supplier.供应商编码 ==='
GO
SELECT TOP 20 h.单据编号, h.供应商,
       (SELECT TOP 1 s.供应商编码 FROM bs_supplier s WHERE s.供应商名称 = h.供应商 OR s.供应商编码 = h.供应商) AS 解析到的供应商编码
FROM qc_return h
WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
ORDER BY h.单据编号 DESC;
GO
