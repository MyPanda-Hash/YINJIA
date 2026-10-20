/* ============================================================
   migrate-plang-ja-guard-trigger-20261020.sql
   **阻止**「外部程序把工单写成已结案」—— plang 上的结案守卫触发器

   为什么加它（2026-10-20 用户口径）：
     「以后手机端报工不要导致结案现象」。
     手机端小程序/参考库是**直连库**写 plang 的，它会在建单/报工时顺手写 ja='Y'。
     MES 侧此前只有两条防线：
       ① 读侧收口（PlangClose：页面/池/守卫都不再信裸 ja）—— 但列表上的「结案异常」红标还在；
       ② 定时自愈（WorkOrderCloseGuard，每分钟把违规的 ja 改回 N）—— 是**事后纠正**。
     本脚本补的是**事前阻止**：触发器在 INSERT/UPDATE 的**同一个事务里**把违规的 ja 改回 N，
     ⇒ 外部程序写进去的 Y 永远不会留在库里，红标/假结案从源头上不产生。
     而且它不依赖 MES 进程：MES 停着、手机端单独写库，也一样挡得住。

   判据（与 PlangClose.anomaly / 页面「结案异常」/ 巡检 / 回正脚本**同一份**）：
     违规 = ja ∈ ('T','Y')
            且 NOT (排产 pl_sl > 0 且 入库 rk_sl ≥ pl_sl)
            且 工单号 NOT LIKE 'GD2608%'（参考库时代真结过的历史单豁免）
     —— MES 自己的两条结案路径都要求「入库 ≥ 排产」，所以这个条件**永远不会误伤**
        MES 的正常结案（手工结案/自动结案都不满足"违规"）。

   行为：
     · 静默纠正（把 ja 改回 N），**不抛错**——外部程序的事务照常提交，只是那个 Y 不生效；
       抛错会打断它的报工事务，可能让现场"扫码没反应"，所以选静默纠正。
     · 不动 asp_user1/2/time 等留痕列（保留"谁在什么时候写过这行"的原样证据）。
     · 自己改自己会再次触发 ⇒ 用 TRIGGER_NESTLEVEL() > 1 直接返回，避免递归。

   生效范围：INSERT 与 UPDATE 都挡（建单时写 Y、报工时改 Y 都会被抓）。
   性能：plang 只有几百行，触发器的 UPDATE 走 id 主键，开销可忽略。

   幂等：CREATE OR ALTER，可重复执行。
   回滚：DROP TRIGGER dbo.trg_plang_ja_guard;
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL
BEGIN
    PRINT N'[跳过] 无 plang 表';
    RETURN;
END

PRINT N'== 创建/更新触发器 dbo.trg_plang_ja_guard ==';
GO

CREATE OR ALTER TRIGGER dbo.trg_plang_ja_guard
ON dbo.plang
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 自己改自己会再次触发；嵌套层 > 1 直接返回（防递归）
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE p
       SET p.ja = N'N'
      FROM dbo.plang p
      JOIN inserted i ON i.id = p.id
     WHERE ISNULL(p.ja, 'N') IN (N'T', N'Y')
       AND p.pl_no NOT LIKE N'GD2608%'
       AND NOT (ISNULL(p.pl_sl, 0) > 0 AND ISNULL(p.rk_sl, 0) >= ISNULL(p.pl_sl, 0));
END
GO

PRINT N'[OK] 触发器已创建';
GO

-- 自检①：触发器存在
IF OBJECT_ID(N'dbo.trg_plang_ja_guard', N'TR') IS NOT NULL
    PRINT N'[PASS] trg_plang_ja_guard 存在'
ELSE
    PRINT N'[FAIL] 触发器未创建';
GO

-- 自检②：当前库里是否还有"违规的 ja"（触发器只挡新增/改动，存量要用回正脚本清）
DECLARE @left int = (
    SELECT COUNT(*) FROM dbo.plang p
     WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
       AND ISNULL(p.ja,'N') IN (N'T',N'Y')
       AND p.pl_no NOT LIKE N'GD2608%'
       AND NOT (ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)));
PRINT N'[存量] 库里仍有 ' + CAST(@left AS nvarchar(10))
    + N' 行「入库<排产却 ja=Y」（触发器只保证以后不再产生；存量点「结案回正」或跑 migrate-plang-ja-foreign-close-repair-20261018.sql）';
GO
