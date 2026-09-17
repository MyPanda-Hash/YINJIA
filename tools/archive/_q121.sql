SET NOCOUNT ON;
-- 清掉旧的错误ERP单号(=MES编号的),让用户重新转获取金蝶编号
UPDATE bd_purchase_in SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL
WHERE 是否已转ERP = N'是' AND ERP单号 = 单据编号;
UPDATE bd_sale_out SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL
WHERE 是否已转ERP = N'是' AND ERP单号 = 单据编号;
SELECT 单据编号, 是否已转ERP, ERP单号 FROM bd_purchase_in;
