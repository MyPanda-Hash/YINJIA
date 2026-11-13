/* ============================================================================
   migrate-purchase-in-price-not-required-20261113.sql
   ----------------------------------------------------------------------------
   用户口径(2026-11-13):
     「采购入库的单价可以放开,但是仓库不可以。」

   改什么:**只把 PURCHASE_IN 明细「单价」的 required 改成 0**。
   **「仓库」保持必填**——用户明确说不放开,脚本里带断言:改完 仓库 必须仍是 required=1,
   否则报错回滚(防止以后有人顺手把整组一起放开)。

   不碰表结构:`bl_purchase_in.[单价]` 本来就是可空 decimal;必填只是元数据位,
   前端 `isRequired` 与后端 `ButtonService.ensureDetailRequiredFilled` 读的是同一份。
   幂等:已经是非必填时打印跳过。
   ============================================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;

DECLARE @before int, @n int, @after int;

SELECT @before = COUNT(*) FROM yj_field WHERE required = 1;

/* 前置守卫:单价必须正好 1 行 required=1 */
SELECT @n = COUNT(*) FROM yj_field
 WHERE RTRIM(panel_code) = 'PURCHASE_IN'
   AND place LIKE '%detail%'
   AND label = N'单价'
   AND required = 1;
IF @n = 0
    PRINT N'[跳过] PURCHASE_IN 明细「单价」已经不是必填(幂等)';
ELSE IF @n <> 1
    RAISERROR(N'前置校验失败:PURCHASE_IN 明细「单价」应恰有 1 行 required=1,实际 %d —— 未改任何数据', 16, 1, @n);
ELSE
BEGIN
    UPDATE yj_field SET required = 0
     WHERE RTRIM(panel_code) = 'PURCHASE_IN'
       AND place LIKE '%detail%'
       AND label = N'单价';
    PRINT N'[更新] PURCHASE_IN 明细「单价」required 1 → 0';
END

/* 改后自检 1:全表必填行数只能是"不变"或"少 1" */
SELECT @after = COUNT(*) FROM yj_field WHERE required = 1;
IF @after <> @before AND @after <> @before - 1
    RAISERROR(N'自检失败:required=1 行数 改前 %d / 改后 %d,不是预期的「不变」或「少 1」', 16, 1, @before, @after);

/* 改后自检 2:单价已放开 */
IF EXISTS (SELECT 1 FROM yj_field WHERE RTRIM(panel_code) = 'PURCHASE_IN'
             AND place LIKE '%detail%' AND label = N'单价' AND required = 1)
    RAISERROR(N'自检失败:PURCHASE_IN 明细「单价」仍是必填', 16, 1);

/* 改后自检 3(用户红线):仓库必须仍是必填 —— 若被一起放开,这里直接报错 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE RTRIM(panel_code) = 'PURCHASE_IN'
                 AND place LIKE '%detail%' AND label = N'仓库' AND required = 1)
    RAISERROR(N'自检失败:PURCHASE_IN 明细「仓库」必须保持必填(用户明确「仓库不可以」放开)', 16, 1);

PRINT N'[现状] PURCHASE_IN 明细必填字段:';
SELECT label AS 字段, seq AS 序号, required AS 必填
  FROM yj_field
 WHERE RTRIM(panel_code) = 'PURCHASE_IN' AND place LIKE '%detail%' AND required = 1
 ORDER BY seq;

PRINT N'[完成] required=1 总行数 ' + CAST(@before AS nvarchar(20)) + N' → ' + CAST(@after AS nvarchar(20));
GO
