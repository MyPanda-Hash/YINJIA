-- _sample-reset-erp.sql — 一次性(链外,不进清单)
-- 用途:Phase 3 端到端验证 —— 把测试账套的样例单据复位成「未转ERP」,
--   否则转ERP 会被重复转入守卫挡住(KingdeePushService:「该单据已转入ERP,不可重复转入」),
--   也就测不到真推送路径。⚠ 只作用于 asp_user1='样例取样' 的测试账套样例行。
SET NOCOUNT ON;
UPDATE bd_finish_in SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
UPDATE bd_other_in  SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
UPDATE bd_other_out SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
PRINT N'样例已复位为「未转ERP」';
