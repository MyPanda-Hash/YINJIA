-- migrate-stock-flow-opening-2026-09-30.sql
-- 任务 2:期初建账单 —— 把 kucun 现有余量落成 inh 的期初结存流水(src = 0)
-- 幂等,两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)
--
-- 为什么必须做:老系统有期初建账单(INIT_BALANCE),本系统从来没有
--   (migrate-stock-ledger-open-close.sql:2-3 自述"我们无建账单")。
--   三表结构(kucun 结存缓存 + inh/outh 流水,流水为唯一真源)一旦生效,
--   不补期初 ⇒ 报表余量凭空为 0。
--
-- 硬前提:UX_inh_src_rid 必须是**过滤索引**(WHERE rid IS NOT NULL)。
--   非过滤唯一索引下 SQL Server 只允许一个 NULL,期初行 (src=0, rid=NULL) 只能落 1 行,
--   插第二行即报 2601。该索引已由 migrate-stock-flow-index-filter-2026-09-30.sql(任务 1b)改好。
--
-- ⚠ 与《2026-09-30-库存三表结构.md》任务 2 原稿的**三处偏离**(均为实测,详见各自注释):
--   ① 原稿写 `i.主计量单位` —— bs_inv **没有**这一列,实际列名是 `计量单位`(见 §偏离①)。
--   ② 原稿两个 `LEFT JOIN`(bs_inv / bs_wh)会**把行数翻倍**:bs_wh 里 CK01..CK05 各有 2 行同名同状态的
--      重复登记(两账套一致,实测 18 行 / 13 个编码),join 后期初变成 61 行 / 31848 而非 31 行 / 15939
--      —— 原稿自带的自检会 **[FAIL]**,而且是**先把 61 行脏数据写进 inh 之后**才报。
--      故改为 `OUTER APPLY (SELECT TOP 1 ... ORDER BY id)` 一一取行(见 §偏离②)。
--   ③ 生成前加**预检**(先算不写):预检不过即 RAISERROR(16,1) 中止且**不写入 inh**(INSERT 在 ELSE 分支,
--      预检不过时不可达),不重演"先写脏数据再报 FAIL";失败时三组数字随错误消息一起报出。
--
-- 幂等策略:src=0 且未作废的行已存在 ⇒ 整段跳过。
--   ⚠ 期初是**生成时点的一次性快照**:日后 kucun 被真实业务流水改动后,"期初合计 = kucun 余量"必然不再成立,
--     此时重跑本脚本,自检段会打印 [FAIL] —— 那是**正常现象**,不代表期初坏了(判据是"生成当次是否一致")。
--
-- 自检输出走 PRINT;注意 DbSync 只回显白名单外**非 0** 错误码的 warning,**PRINT(错误码 0) 不回显**,
--   所以要看到本脚本的自检数字,用:
--   java '-Dstdout.encoding=UTF-8' -cp tools\lib\mssql-jdbc.jar tools\archive\_verify-stock-opening-2026-09-30.java <库名> tools\migrate-stock-flow-opening-2026-09-30.sql
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════
   守卫:inh 还是旧结构就先别动(任务 1 未跑)
   ═══════════════════════════════════════════════════════════════════════ */
IF COL_LENGTH('dbo.inh', N'src') IS NULL
BEGIN
  PRINT N'[SKIP] inh 还是旧结构(无 src 列),先跑 migrate-stock-flow-tables-2026-09-30.sql';
  RETURN;
END
GO

/* ═══════════════════════════════════════════════════════════════════════
   生成期初(仅一次)
   §偏离① 列名:bs_inv 实际列 = 存货编码 / 存货名称 / 规格型号 / 计量单位(共 145 列,两账套实测)
           —— 没有「主计量单位」,故取 i.计量单位。
   §偏离② 取数:bs_inv、bs_wh 都用 OUTER APPLY + TOP 1(ORDER BY id) 一一取行。
           实测 bs_wh 18 行只有 13 个不同「仓库编码」,CK01..CK05 各登记了 2 行(仓库名称/停用/状态
           完全相同,id 1-5 与 14-18);原稿 LEFT JOIN 会让 30 行 kucun 各命中 2 次
           ⇒ 61 行 / 31848(实测。bs_wh 侧 1 行、bs_inv 侧 30 行,kucun 共 31 行)。
           bs_inv 当前 114 行 / 114 个编码不重复,但同样按一一取行写,
           防止它以后被导入重复编码时重演同一个坑。
           核对面(两账套实测一致):kucun 31 行 / 余量 15939.0000 / 金额 804998.1700。
   §偏离③ 预检:先落到 #opening 算三组数(行数 / 数量合计 / 金额合计)与 kucun 对齐,
           不过就 RAISERROR(@msg, 16, 1) 中止(DbSync 判本脚本失败、不记入 yj_schema_log,下次 sync 重试),
           **绝不先写脏数据再报 FAIL**。
   ═══════════════════════════════════════════════════════════════════════ */
IF NOT EXISTS (SELECT 1 FROM inh WHERE src = 0 AND ISNULL(asp_cancel,'N') <> 'Y')
BEGIN
  IF OBJECT_ID('tempdb..#opening') IS NOT NULL DROP TABLE #opening;

  SELECT 0 AS src,
         CAST(NULL AS bigint) AS rid,
         N'INIT-' + CONVERT(nvarchar(8), GETDATE(), 112) AS 单据编号,
         N'期初结存' AS 单据类型,
         -- 期初日 = 今天零点前(必须早于任何真实业务流水)
         -- 期初日期取**固定远古日期**,不取"昨天零点"(2026-09-30 Lead 修正)。
         -- 理由:移动加权成本是按 (仓库键,存货编码) 分区、按 (单据日期, src, rid) 顺序递归滚出来的
         --   (见 InvCostService)。系统刚上线,必然存在**补录历史单据**;若期初定在"昨天",
         --   任何早于昨天的补录单都会排到**期初之前**,于是"先出库后入库" ⇒ 出库成本算 0、
         --   结存为负 —— 老 ERP 用固定远古日期正是为了避免这个。
         --   代价:报表上看期初的日期是 1900-01-01(不代表业务时点,是"早于一切业务"的哨兵值)。
         CAST('1900-01-01' AS datetime) AS 单据日期,
         k.wzdm AS 物料编码,
         ISNULL(i.存货名称, k.wzdm) AS 物料名称,
         i.规格型号 AS 规格型号,
         i.计量单位 AS 计量单位,
         k.ckdm AS 仓库编码,
         ISNULL(w.仓库名称, k.ckdm) AS 仓库名称,
         ISNULL(NULLIF(RTRIM(k.lot_no), ''), N'(未填批号)') AS 批号,
         -- kucun.yl / kucun.price 是 float,显式 CAST 到 inh 的目标精度,避免浮点尾差
         CAST(ISNULL(k.yl,0) AS decimal(18,4)) AS 数量,
         CAST(ISNULL(k.price,0) AS decimal(18,6)) AS 单价,
         CAST(CAST(ISNULL(k.yl,0) AS decimal(18,4)) * CAST(ISNULL(k.price,0) AS decimal(18,6)) AS decimal(18,4)) AS 金额,
         CAST(NULL AS nvarchar(400)) AS 往来单位,
         N'migration' AS 经手人,
         N'migration' AS asp_user1,
         GETDATE() AS asp_time1,
         N'N' AS asp_cancel
    INTO #opening
    FROM kucun k
   OUTER APPLY (SELECT TOP 1 存货名称, 规格型号, 计量单位 FROM bs_inv i
                 WHERE i.存货编码 = k.wzdm ORDER BY i.id) i
   OUTER APPLY (SELECT TOP 1 仓库名称 FROM bs_wh w
                 WHERE w.仓库编码 = k.ckdm ORDER BY w.id) w
   WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND ISNULL(k.yl,0) <> 0;

  DECLARE @cnt int, @qty decimal(18,4), @amt decimal(18,4);
  SELECT @cnt = COUNT(*), @qty = CAST(ISNULL(SUM(数量),0) AS decimal(18,4)),
         @amt = CAST(ISNULL(SUM(金额),0) AS decimal(18,4)) FROM #opening;

  DECLARE @kcnt int, @kqty decimal(18,4), @kamt decimal(18,4);
  SELECT @kcnt = COUNT(*), @kqty = CAST(ISNULL(SUM(yl),0) AS decimal(18,4)),
         @kamt = CAST(ISNULL(SUM(yl*price),0) AS decimal(18,4))
    FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) <> 0;

  PRINT N'[预检] 待生成 ' + CAST(@cnt AS nvarchar(10)) + N' 行 / 数量 ' + CAST(@qty AS nvarchar(30))
      + N' / 金额 ' + CAST(@amt AS nvarchar(30));
  PRINT N'[预检] kucun 侧 ' + CAST(@kcnt AS nvarchar(10)) + N' 行 / 余量 ' + CAST(@kqty AS nvarchar(30))
      + N' / 金额 ' + CAST(@kamt AS nvarchar(30));

  -- ⚠ 结构上把 INSERT 放进 **ELSE 分支**:预检不过时它**不可达**,不依赖 RAISERROR 是否中止批次
  --   (实测:THROW / RAISERROR(16,1) 在 DbSync 下都表现为 SQLException ⇒ 判 [SQL失败]、不记入
  --    yj_schema_log、下次 sync 重试;但失败路径上本批的 PRINT 数字会随异常一起丢,
  --    所以① 用 IF/ELSE 让"写不写"只由条件决定,② 把三组数字直接拼进错误消息,失败时也能看到数)。
  IF @cnt <> @kcnt OR ABS(@qty - @kqty) >= 0.01 OR ABS(@amt - @kamt) >= 0.01
  BEGIN
    DECLARE @msg nvarchar(400) =
        N'[FAIL] 期初预检不通过,**未写入 inh**:待生成 ' + CAST(@cnt AS nvarchar(10)) + N' 行/数量 '
      + CAST(@qty AS nvarchar(30)) + N'/金额 ' + CAST(@amt AS nvarchar(30))
      + N';kucun 侧 ' + CAST(@kcnt AS nvarchar(10)) + N' 行/余量 ' + CAST(@kqty AS nvarchar(30))
      + N'/金额 ' + CAST(@kamt AS nvarchar(30)) + N'(先查取数是否把行数放大)';
    PRINT @msg;
    RAISERROR(@msg, 16, 1);
  END
  ELSE
  BEGIN
    INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                     仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 往来单位, 经手人,
                     asp_user1, asp_time1, asp_cancel)
    SELECT src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
           仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 往来单位, 经手人,
           asp_user1, asp_time1, asp_cancel
      FROM #opening;

    DECLARE @ins int;
    SET @ins = @@ROWCOUNT;

    -- ⚠ PRINT 里**不能写子查询**(实测报「在此上下文中不允许使用子查询。只允许使用标量表达式。」,
    --   而且是**编译期**错误 ⇒ 整批一条都不执行、连 INSERT 也不落库);故先取到变量再拼串。
    DECLARE @no nvarchar(100), @dt datetime;
    SELECT TOP 1 @no = 单据编号, @dt = 单据日期 FROM #opening;

    PRINT N'[OK] 期初建账单已生成,' + CAST(@ins AS nvarchar(6)) + N' 行'
        + ISNULL(N'(单据编号 ' + @no + N',单据日期 ' + CONVERT(nvarchar(10), @dt, 120)
                + N',批号取 kucun.lot_no,单价取 kucun.price)', N'');
  END

  DROP TABLE #opening;
END
ELSE PRINT N'[SKIP] 期初结存已存在(src=0 且未作废的行)';
GO

/* ═══════════════════════════════════════════════════════════════════════
   自检:期初流水合计 == kucun 余量合计(允许 1 分钱误差)+ 行数必须相等
   行数这一条是**额外加的**:原稿只比合计,而合计恰好相等时行数仍可能被 join 放大
   (本库 bs_wh 重复登记就会放大),故把行数列为同一道闸门。
   ═══════════════════════════════════════════════════════════════════════ */
DECLARE @flow_n int, @flow decimal(18,4), @flow_amt decimal(18,4);
SELECT @flow_n = COUNT(*), @flow = CAST(ISNULL(SUM(数量),0) AS decimal(18,4)),
       @flow_amt = CAST(ISNULL(SUM(金额),0) AS decimal(18,4))
  FROM inh WHERE src = 0 AND ISNULL(asp_cancel,'N') <> 'Y';

DECLARE @kuc_n int, @kuc decimal(18,4), @kuc_amt decimal(18,4);
SELECT @kuc_n = COUNT(*), @kuc = CAST(ISNULL(SUM(yl),0) AS decimal(18,4)),
       @kuc_amt = CAST(ISNULL(SUM(yl*price),0) AS decimal(18,4))
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) <> 0;

PRINT N'[自检] 期初行数 ' + CAST(@flow_n AS nvarchar(10)) + N'(kucun 侧 ' + CAST(@kuc_n AS nvarchar(10)) + N' 行)';
IF @flow_n = @kuc_n AND ABS(@flow - @kuc) < 0.01 AND ABS(@flow_amt - @kuc_amt) < 0.01
  PRINT N'[OK] 自检通过:期初流水合计 ' + CAST(@flow AS nvarchar(30)) + N' = kucun 余量合计 ' + CAST(@kuc AS nvarchar(30))
      + N';期初金额 ' + CAST(@flow_amt AS nvarchar(30)) + N' = kucun 金额 ' + CAST(@kuc_amt AS nvarchar(30));
ELSE
  PRINT N'[FAIL] 自检异常:期初流水 ' + CAST(@flow_n AS nvarchar(10)) + N' 行/' + CAST(@flow AS nvarchar(30))
      + N' ≠ kucun 余量 ' + CAST(@kuc_n AS nvarchar(10)) + N' 行/' + CAST(@kuc AS nvarchar(30));
GO

/* ═══════════════════════════════════════════════════════════════════════
   快照(信息性,只用 PRINT:DbSync 不消费结果集,脚本里不放裸 SELECT)
   ═══════════════════════════════════════════════════════════════════════ */
DECLARE @snap nvarchar(max) = STUFF((SELECT N', src=' + CAST(src AS nvarchar(10)) + N' ' + CAST(COUNT(*) AS nvarchar(10))
        + N' 行/' + CAST(CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) AS nvarchar(30))
      FROM inh GROUP BY src ORDER BY src FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '');
PRINT N'[快照] inh 现有流水: ' + ISNULL(@snap, N'(空表)');

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_inh_src_rid' AND has_filter = 1)
  PRINT N'[OK] UX_inh_src_rid 仍是过滤索引(rid IS NOT NULL),可容纳任意多行期初';
ELSE
  PRINT N'[FAIL] UX_inh_src_rid 不是过滤索引 —— 期初多行会被 2601 拦下';
GO
