SET NOCOUNT ON;
-- 模拟用户在 MES 里修改了一张单据
UPDATE bd_purchase_in SET 备注 = N'用户修改过的备注', asp_time2 = GETDATE() WHERE 单据编号 = 'CGRK-20260915-03213';
