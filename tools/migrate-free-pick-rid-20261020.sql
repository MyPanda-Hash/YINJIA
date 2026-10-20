-- migrate-free-pick-rid-20261020.sql
-- 临时解封:把「挡路的历史库存流水行」的 rid 搬到 900000000+ 号段,释放小号 rid 给扫码领料小程序。
--
-- 【为什么要这么干】
--   小程序写 outh 时 rid = plang.id(工单行 id),MES 自己的流水 rid = bl_material_out.id,
--   两段号都在 1~4655 ⇒ plang 466 张工单行里 462 张的 rid 已经被历史流水占着(2026-10-20 实测)。
--   唯一索引 2026-10-20 已放宽到 (src,rid,物料编码,批号),但**"同一 (物料,批号) 已被占"仍会撞**:
--   例:GD-2026-10-0223 行1 = rid 1168,被 SCLL-20260919-00013 的 YJ-JPL-54/JPL-20260910 占着。
--
-- 【改法:搬号,不删行】
--   UPDATE outh.rid += 900000000(行、数量、金额、单据编号都不动),inv_cost_ledger.rid 同步搬
--   ⇒ 结存/台账/成本金额一个数都不变(两个视图按 src+rid+存货+批号 JOIN 成本表,得一起搬才对得上)。
--   ⚠ 物理删除是**错的**:删一行就让库存状况表凭空多出该物料的数量、成本台账留孤儿
--     (实测:删 (6,1168) 会让 YJ-JPL-54 在 YCL-01 的结存 +4)。本脚本一行都不删。
--
-- 【代价(必须知道)】
--   被搬过的历史单据(如 SCLL-20260919-00013)以后**不要弃审/重审** ——
--   弃审按 (src,rid,物料) 找流水,搬过号就找不到该行 ⇒ 弃审不冲销、重审再插一行 = 双倍扣账。
--   真要反审,先用 @offset = -900000000 跑同一条搬回来。
--   这是临时解封;根治仍是「小程序 rid 加偏移」或「扫码领料独立段号 src=13」。
--
-- 【模式】(脚本头一个变量)
--   @mode = 0  只打印计划与影响(默认,不写任何数据)
--   @mode = 1  执行并提交
--   @mode = 2  演练:执行 + 复核 + 回滚(上线前自测用)
--
-- 【怎么用】(服务器 C:\yinjia\tools)
--   sqlcmd -I -S localhost -E -d HSDZ_MES -f i:65001 -i migrate-free-pick-rid-20261020.sql
--   先 @mode=0 看计划 → 改 @mode=2 演练 → 改 @mode=1 执行 → 改回 @mode=0 存档。
--   执行完让小程序重扫一次即可(rid 仍是 plang.id,只是不再撞)。
--
-- 幂等:搬过的行 rid 已是 900000000+,再跑不会重复搬(带 NOT EXISTS 守卫)。
-- 两个账套都要跑(HSDZ_MES 先、HSDZ_MES_TEST 后;测试账套数据不同,可能 0 行)。

SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @mode   int    = 0;                  -- 0=dry-run / 1=apply / 2=rehearse
DECLARE @offset bigint = 900000000;          -- 搬运偏移(回退时传 -900000000)
DECLARE @srcOut int    = 6;                  -- 材料出库段号
DECLARE @topN   int    = 20;                 -- 解封「最近 N 张工单行」(按 plang.id 倒序)

-- 只想解封指定几张时,把 @topN 置 0 并在这里列 plang.id:
DECLARE @picked TABLE (rid bigint PRIMARY KEY);
-- INSERT INTO @picked (rid) VALUES (1168),(1167);

DECLARE @target TABLE (rid bigint PRIMARY KEY);
INSERT INTO @target (rid)
SELECT id FROM (SELECT TOP (@topN) id FROM dbo.plang WHERE @topN > 0 ORDER BY id DESC) t
UNION
SELECT rid FROM @picked;

PRINT '=== 1) 要解封的工单行 ===';
SELECT p.id AS 工单行id, p.pl_no, p.pl_xc, p.mc, p.pl_sl
  FROM dbo.plang p JOIN @target t ON t.rid = p.id ORDER BY p.id DESC;

PRINT '=== 2) 挡路的流水行(搬的就是这些;行/数量/金额/单据编号都不改)===';
SELECT o.id, o.rid AS 原rid, o.rid + @offset AS 新rid, o.单据编号, o.物料编码, o.批号, o.数量, o.asp_cancel
  FROM dbo.outh o JOIN @target t ON t.rid = o.rid
 WHERE o.src = @srcOut ORDER BY o.rid DESC;

PRINT '=== 3) 成本台账里跟着搬的行 ===';
SELECT c.rid AS 原rid, COUNT(*) AS 行数
  FROM dbo.inv_cost_ledger c JOIN @target t ON t.rid = c.rid
 WHERE c.src = @srcOut GROUP BY c.rid ORDER BY c.rid DESC;

PRINT '=== 4) 搬运前基线(执行后必须逐项相同)===';
SELECT (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS 台账行数,
       (SELECT SUM(收入数量) FROM dbo.v_stock_ledger) AS 收入合计,
       (SELECT SUM(发出数量) FROM dbo.v_stock_ledger) AS 发出合计,
       (SELECT SUM(现存量) FROM dbo.v_stock_balance) AS 现存量合计,
       (SELECT COUNT(*) FROM dbo.outh) AS outh行数;

IF @mode <> 0
BEGIN
  BEGIN TRAN;

  UPDATE o
     SET o.rid = o.rid + @offset
    FROM dbo.outh o JOIN @target t ON t.rid = o.rid
   WHERE o.src = @srcOut
     AND NOT EXISTS (SELECT 1 FROM dbo.outh x
                      WHERE x.src = o.src AND x.rid = o.rid + @offset
                        AND ISNULL(x.物料编码,N'') = ISNULL(o.物料编码,N'')
                        AND ISNULL(x.批号,N'') = ISNULL(o.批号,N''));

  UPDATE c
     SET c.rid = c.rid + @offset
    FROM dbo.inv_cost_ledger c JOIN @target t ON t.rid = c.rid
   WHERE c.src = @srcOut
     AND NOT EXISTS (SELECT 1 FROM dbo.inv_cost_ledger y
                      WHERE y.src = c.src AND y.rid = c.rid + @offset
                        AND ISNULL(y.存货编码,N'') = ISNULL(c.存货编码,N'')
                        AND ISNULL(y.批号,N'') = ISNULL(c.批号,N''));

  PRINT '=== 5) 搬运后(应:台账行数/收入/发出/现存量合计 与 4) 完全一致)===';
  SELECT (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS 台账行数,
         (SELECT SUM(收入数量) FROM dbo.v_stock_ledger) AS 收入合计,
         (SELECT SUM(发出数量) FROM dbo.v_stock_ledger) AS 发出合计,
         (SELECT SUM(现存量) FROM dbo.v_stock_balance) AS 现存量合计,
         (SELECT COUNT(*) FROM dbo.outh) AS outh行数;

  PRINT '=== 6) 原来挡路的小号 rid(应为空 = 小程序可以写了)===';
  SELECT o.rid, o.单据编号, o.物料编码, o.批号
    FROM dbo.outh o JOIN @target t ON t.rid = o.rid
   WHERE o.src = @srcOut;

  IF @mode = 1
  BEGIN COMMIT;   PRINT '[COMMITTED] 已提交。'; END
  ELSE
  BEGIN ROLLBACK; PRINT '[REHEARSED] 已回滚(本次只演练,没改数据)。'; END
END
ELSE
  PRINT '[DRY-RUN] 只打印,没有改任何数据。把 @mode 改成 1 才执行。';

PRINT '=== 7) 复测:往目标 rid 插一行测试(事务内,统一回滚)===';
BEGIN TRAN;
BEGIN TRY
  INSERT INTO outh (src,rid,单据编号,物料编码,物料名称,批号,数量,asp_user1,asp_time1,asp_cancel)
  VALUES (@srcOut, (SELECT TOP 1 rid FROM @target ORDER BY rid DESC), N'PROBE', N'PROBE-MAT', N'PROBE', N'PROBE-B', 1, N'probe', GETDATE(), 'N');
  SELECT N'[PASS] 目标 rid 已可写(小程序能写了)' AS 复测结果;
END TRY
BEGIN CATCH
  SELECT N'[BLOCKED] 仍撞:' + ERROR_MESSAGE() AS 复测结果;
END CATCH;
ROLLBACK;
