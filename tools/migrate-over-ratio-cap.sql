/* ============================================================================
 * 分批送料「超送」口径修正(2026-09-22,无 DDL,只改参数登记与钳制):
 *   ① 上限改按**订单全部数量**算:可送上限 = 订单数量×(1+超送比例) − 已送 + 已退回
 *      (旧口径 剩余×(1+比例) 每批只给当批剩余的比例额,分批越多额度越算越少);
 *   ② 超送比例**最高 50%**(用户口径):代码侧 BatchService.overRatio / PushGenerateHandler
 *      的弹窗覆盖一律钳 0~0.5;本脚本把库里存超 0.5 的值钳回 0.5,并更新参数备注为新公式。
 * 配套代码(同提交):PushGenerateHandler(overAllowance + batchLines 可送上限 + generateBatch 校验)、
 *   VoucherFlowService.sources(选单路径同公式)、前端 BatchSendDialog + batchSendLines.overAllowance。
 * 验证:tools/archive/_verify-over-ratio.mjs。
 * ========================================================================== */
SET NOCOUNT ON;
GO

UPDATE yj_app_setting
SET remark = N'收料允许超送比例(小数 0~0.5;0=不允许,**最高 50%**)。分批送料校验:本次送料量 ≤ 订单数量×(1+比例)−已送+已退回(**按全部数量算**,2026-09-22 口径)'
WHERE setting_key = N'receive_over_ratio'
  AND remark <> N'收料允许超送比例(小数 0~0.5;0=不允许,**最高 50%**)。分批送料校验:本次送料量 ≤ 订单数量×(1+比例)−已送+已退回(**按全部数量算**,2026-09-22 口径)';
PRINT N'参数备注已更新为新口径';
GO

-- 值 > 0.5 钳到 0.5(代码同钳;当前库 0.05 不受影响)
UPDATE yj_app_setting
SET setting_value = N'0.5'
WHERE setting_key = N'receive_over_ratio'
  AND TRY_CAST(setting_value AS float) > 0.5;
GO

-- 自检
IF EXISTS (SELECT 1 FROM yj_app_setting WHERE setting_key = N'receive_over_ratio'
           AND (TRY_CAST(setting_value AS float) < 0 OR TRY_CAST(setting_value AS float) > 0.5))
    RAISERROR(N'receive_over_ratio 超出 0~0.5', 16, 1);
PRINT N'✅ 超送口径迁移完成:比例钳 0~0.5,备注=按订单全部数量计算';
GO
