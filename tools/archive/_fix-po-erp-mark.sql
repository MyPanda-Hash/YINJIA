SET NOCOUNT ON;
/* 账目对齐:沙箱已存在 YJ-20260909-01 订单(3 分录),MES 侧标记补齐为已转(ERP单号=同号) */
UPDATE bd_pu_order SET 是否已转ERP = N'是', ERP单号 = N'YJ-20260909-01', 转ERP操作人 = N'admin', 转ERP时间 = CONVERT(nvarchar(30), GETDATE(), 120)
 WHERE 单据编号 = N'YJ-20260909-01' AND ISNULL(是否已转ERP, N'否') <> N'是';
SELECT 单据编号, 是否已转ERP, ERP单号, 转ERP操作人 FROM bd_pu_order WHERE 单据编号 = N'YJ-20260909-01';
GO
