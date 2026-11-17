/* ============================================================================
   migrate-pu-order-price-wh-not-required-20261113.sql
   ----------------------------------------------------------------------------
   用户口径(2026-11-13):
     「采购订单的单价不是必填」
     「采购订单的单价和仓库不是必填」

   改什么:**只把 PU_ORDER 明细里「单价」「仓库」两行的 yj_field.required 改成 0**。
   为什么不用动表:`bl_pu_order.[单价]/[仓库]` 本来就是可空(decimal / nvarchar),
   必填纯粹是元数据位;后端明细必填校验(`ButtonService.ensureDetailRequiredFilled`)
   就是 `fieldsAt("detail").filter(required)`。前端红星也读同一份 `isRequired`
   ⇒ 改元数据即前后端同时生效。

   不碰:`yj_panel`、其它字段、其它面板。采购入库单 PURCHASE_IN 的这两项**仍是必填**
   (用户没提),要改另开脚本,别顺手带上。
   幂等:已经是非必填时打印跳过,不报错、不改任何行。
   ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;

DECLARE @before int, @n int, @after int;

/* 改前基线:全表 required=1 的行数(改后 = 改前 − 本次实际改动行数;已全放开时为不变) */
SELECT @before = COUNT(*) FROM yj_field WHERE required = 1;

/* 前置守卫:两行**必须都在**(防面板/标签改名后误改)。
   ⚠ 2026-11-15 修:旧守卫要求「恰有 2 行 required=1」,而生产库实测「仓库」早已是非必填、
   只有「单价」=1 ⇒ 直接 RAISERROR 中止(部署时才暴露)。改为「在就都置 0」,用 @@ROWCOUNT 自检,
   对「两行都必填 / 只一行必填 / 都已放开」三种真实状态都幂等。 */
SELECT @n = COUNT(*) FROM yj_field
 WHERE RTRIM(panel_code) = 'PU_ORDER'
   AND place LIKE '%detail%'
   AND label IN (N'单价', N'仓库');
IF @n <> 2
    RAISERROR(N'前置校验失败:PU_ORDER 明细「单价」「仓库」应恰有 2 行(不论必填),实际 %d —— 未改任何数据', 16, 1, @n);

DECLARE @changed int = 0;
UPDATE yj_field SET required = 0
 WHERE RTRIM(panel_code) = 'PU_ORDER'
   AND place LIKE '%detail%'
   AND label IN (N'单价', N'仓库')
   AND required = 1;
SET @changed = @@ROWCOUNT;

IF @changed = 0
    PRINT N'[跳过] PU_ORDER 明细「单价/仓库」已经都不是必填(幂等)';
ELSE
    PRINT N'[更新] PU_ORDER 明细「单价/仓库」required 1 → 0,共 ' + CAST(@changed AS nvarchar(10)) + N' 行';

/* 改后自检 1:全表必填行数应正好少了本次改动的行数 */
SELECT @after = COUNT(*) FROM yj_field WHERE required = 1;
IF @after <> @before - @changed
    RAISERROR(N'自检失败:required=1 行数 改前 %d / 改后 %d,与本次改动 %d 行不符', 16, 1, @before, @after, @changed);

/* 改后自检 2:这两行确实都不再是必填 */
IF EXISTS (SELECT 1 FROM yj_field
            WHERE RTRIM(panel_code) = 'PU_ORDER'
              AND place LIKE '%detail%'
              AND label IN (N'单价', N'仓库')
              AND required = 1)
    RAISERROR(N'自检失败:PU_ORDER 明细「单价/仓库」仍有 required=1', 16, 1);

/* 取证:打印这两行现状 + 提示采购入库单仍为必填 */
PRINT N'[现状] PU_ORDER 明细必填字段清单:';
SELECT label AS 字段, place AS 位置, seq AS 序号, required AS 必填
  FROM yj_field
 WHERE RTRIM(panel_code) = 'PU_ORDER' AND place LIKE '%detail%' AND required = 1
 ORDER BY seq;

PRINT N'[提示] 采购入库单 PURCHASE_IN 的「单价」「仓库」仍为必填(本次未动,用户未要求)';
PRINT N'[完成] required=1 总行数 ' + CAST(@before AS nvarchar(20)) + N' → ' + CAST(@after AS nvarchar(20));
GO
