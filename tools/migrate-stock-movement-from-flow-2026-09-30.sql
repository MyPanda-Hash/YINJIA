-- migrate-stock-movement-from-flow-2026-09-30.sql
-- 把 v_stock_movement 从「8 张 bd_/bl_ 单据表现场 UNION」改为「读流水表 inh/outh」——幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   【新视图定义在此】原定义在 tools/migrate-inv-report-fields.sql 的 §1(第 46~198 行)。
   两者口径必须一致,改动请同步 —— 之所以另起一个脚本而不是改那个历史大脚本:
   DbSync 按**内容哈希**判重跑,改动已执行脚本的字节会让它被"重跑"(历史脚本重跑会撞
   schema 演进,历史上踩过),故新定义另存新文件。

   ── 为什么要改(2026-09-30,库存三表结构的任务 4) ──
   原:每次查询现场拼 8 路 UNION(16 张单据表 + 按名称 LEFT JOIN bs_wh)⇒ 实测缓存计划
       65,021 ms(RECOMPILE 42 ms),前端 axios 15s 超时 —— 报表 65 秒超时的根因。
   现:读 inh/outh 两张流水表(由 StockFlowService 在**审核动作**时同事务写入)⇒ 查两张窄表。
       本任务真正的收益是**把 65 秒的坏计划场景从根上消掉**(不再有 8 路 UNION),
       而不是"今天的报表变快了"(当前库只有 31 行期初,前后耗时都看不出差别)。

   ── 口径变化(本任务的语义核心) ──
   改前:视图认「单据状态='已审核' 或 单据状态2='C' 或 yj_doc_status.shr IS NOT NULL」三重兜底
        ⇒ 金蝶旁路直写的已审核单据**进报表但不进 kucun**("报表进、台账不进")。
   改后:只认流水表,而流水只在审核动作时写 ⇒ **口径统一为"以流水为准"**,长期不一致被消掉。
   代价:流水表诞生**之前**已审核的历史单据**不会**出现在视图里。两账套实测为 0(见提交说明:
        8 张 bd_* 头表全 0 行,而旧视图的 8 个分支都是 `bl_ JOIN bd_`,故旧视图本来就查不出行)。

   ── 列契约:逐列不变(硬约束) ──
   23 列的名字与顺序刻意保持与改前完全一致(src/rid/单据日期/单据类型/单据编号/业务类型/仓库键/
   仓库编码/仓库/存货编码/存货/规格型号/计量单位/批号/收入数量/发出数量/收入金额/发出单据金额/
   含税金额/税额/往来单位/往来单位编码/经手人),故下游 v_stock_ledger / v_stock_balance /
   v_stock_summary 与 InvCostService 的递归 SQL **一行都不用改**。
   类型也刻意对齐改前的宽度(显式 CAST),只有 1 处有意放宽、2 处无法避免,均已实测记录:
     ① 单据类型 nvarchar(6) → nvarchar(50):**有意放宽**。原宽度来自视图里的字面量,改成
        从流水表透传后若硬 CAST 回 6 字符,将来出现更长的单据类型会被**静默截断**。
     ② rid int NOT NULL → int NULL:见下方「rid 的两处坑」。
     ③ 单据类型 NOT NULL → NULL:同②,流水表该列可空(实际值永远非空)。

   ── rid 的两处坑(都是实测复现后才这么写的,不是推测) ──
   坑1(**必须非空**):期初建账单是 (src=0, rid=NULL)(任务 2)。若 rid 原样透传 NULL,
        InvCostService 的 `INSERT INTO inv_cost_ledger (src, rid, ...)` 必失败 ——
        inv_cost_ledger.rid 是 `int NOT NULL` 且 PK=(src,rid)。实测报
        `error 515: 不能将值 NULL 插入列 'rid'`,即**成本重算整段跑不动**。
        正解:`ISNULL(rid, id)` —— 期初行没有来源单据行,就用**流水行自己的 id** 作合成键
        (inh.id 是 IDENTITY,稳定且唯一)。实测插入 31 行成功,PK (src,rid) 无重复。
        注意 src 段号不重叠(inh 0..4 / outh 5..8),两表 id 同值也不会撞 PK。
   坑2(**必须单行兜底**):改前视图末尾是 `LEFT JOIN bs_wh ON w.仓库名称 = m.仓库名称`,
        而 bs_wh 里「原料仓/辅料仓/成品仓/半成品仓/不良品仓」**各登记了 2~3 行同名**(18 行
        只有 11 个不同名称;两账套一致)。按名称 LEFT JOIN 会**把流水行翻倍** ⇒
        v_stock_balance 的 `SUM(数量)` 直接翻倍。实测:计划原稿的行数 62 vs 流水 31,
        现存量合计 **31,898** vs kucun 余量 **15,939**(正好 2 倍)。
        正解:`OUTER APPLY (SELECT TOP 1 … ORDER BY id)` —— 三级兜底的**表达式原样不动**,
        只把「按名称取一行」变成确定的一行(与任务 2 处理 bs_wh/bs_inv 重复行的写法一致)。
        实测行数 31、现存量合计 15,939.0000 = kucun 余量合计,勾稽成立。

   ── 值口径(逐列照抄原 mv CTE 的表达式,保证报表输出不漂) ──
   · 仓库键三级兜底:`ISNULL(ISNULL(自身仓库编码, bs_wh.仓库编码), '#'+仓库名称)` 原样保留。
     任务 3 已把 仓库编码 解析成**档案编码**后回填流水,故 inh/outh.仓库编码 与 kucun.ckdm 同源。
   · 存货编码/批号 保留 `(未填存货)` / `(未填批号)` 兜底(与 kucun 台账口径一致);
   · 金额/单价为空时**原样落 NULL**,不兜成 0(任务 3 刻意如此:落 0 会与报表口径不一致);
   · 含税金额/税额:**恒为 NULL** —— inh/outh 里没有这两列(原视图只有采购入库/销售出库两段有值)。
     影响:库存台账面板(STOCK_LEDGER)的 含税金额/税额 两列将一直为空。这是本任务已知的信息损失,
     待用户拍板是否给流水表补列(补列属任务 1 的表结构范畴,不在本脚本内)。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ⓪ 前置校验:流水表就位才动视图。不满足就让本批抛错 ——
--    DbSync 遇 SQLException 会**中止整个文件**(后续批不再执行)⇒ 老视图不会被 DROP,
--    库保持在"改动前"的一致状态,而不是"视图没了"的半截状态。
IF COL_LENGTH('dbo.inh', N'src') IS NULL OR COL_LENGTH('dbo.outh', N'src') IS NULL
  RAISERROR(N'[FAIL] inh/outh 还不是 MES 流水表(缺 src 列),请先执行 migrate-stock-flow-tables-2026-09-30.sql。本脚本未改动任何对象', 16, 1);
GO

-- ① 卸掉依赖后再重建(依赖视图 v_stock_ledger/v_stock_summary/v_stock_balance 定义不变、
--    列契约不变,重建后按名解析即可,无需重建下游)
IF OBJECT_ID('dbo.v_stock_movement') IS NOT NULL DROP VIEW dbo.v_stock_movement;
GO

-- ② 新定义:读 inh/outh,列契约与改前逐列一致
CREATE VIEW dbo.v_stock_movement AS
SELECT m.src, m.rid, m.单据日期, m.单据类型, m.单据编号, m.业务类型,
       -- 仓库键 = 自身编码 → bs_wh 按名称兜底 → '#'+名称(三级兜底,表达式原样保留)
       ISNULL(ISNULL(m.自身仓库编码, w.仓库编码), N'#' + ISNULL(m.仓库名称, N'(未填仓库)')) AS 仓库键,
       ISNULL(m.自身仓库编码, w.仓库编码) AS 仓库编码,
       ISNULL(m.仓库名称, N'(未填仓库)') AS 仓库,
       m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.收入数量, m.发出数量, m.收入金额, m.发出单据金额, m.含税金额, m.税额,
       m.往来单位, m.往来单位编码, m.经手人
FROM (
  -- 入库流水(inh):src 0 期初结存 / 1 采购入库 / 2 产成品入库 / 3 其他入库 / 4 委外入库
  SELECT src,
         -- 期初行 rid 为 NULL ⇒ 用流水行自身 id 作合成键(见头部「rid 的两处坑」坑1)
         CAST(ISNULL(rid, id) AS int) AS rid,
         CAST(单据日期 AS date) AS 单据日期,
         CAST(单据类型 AS nvarchar(50)) AS 单据类型,
         CAST(单据编号 AS nvarchar(100)) AS 单据编号,
         N'入库' AS 业务类型,
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N'') AS 自身仓库编码,
         CAST(仓库名称 AS nvarchar(200)) AS 仓库名称,
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)') AS 存货编码,
         CAST(物料名称 AS nvarchar(200)) AS 存货,
         CAST(规格型号 AS nvarchar(200)) AS 规格型号,
         CAST(计量单位 AS nvarchar(100)) AS 计量单位,
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)') AS 批号,
         CAST(数量 AS decimal(18,4)) AS 收入数量,
         CAST(0 AS decimal(18,4)) AS 发出数量,
         CAST(金额 AS decimal(18,4)) AS 收入金额,
         CAST(0 AS decimal(18,4)) AS 发出单据金额,
         CAST(NULL AS decimal(18,4)) AS 含税金额,
         CAST(NULL AS decimal(18,4)) AS 税额,
         CAST(往来单位 AS nvarchar(200)) AS 往来单位,
         CAST(NULL AS nvarchar(200)) AS 往来单位编码,
         CAST(经手人 AS nvarchar(200)) AS 经手人
    FROM dbo.inh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
  UNION ALL
  -- 出库流水(outh):src 5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料
  SELECT src, CAST(ISNULL(rid, id) AS int),
         CAST(单据日期 AS date),
         CAST(单据类型 AS nvarchar(50)),
         CAST(单据编号 AS nvarchar(100)),
         N'出库',
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N''),
         CAST(仓库名称 AS nvarchar(200)),
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)'),
         CAST(物料名称 AS nvarchar(200)),
         CAST(规格型号 AS nvarchar(200)),
         CAST(计量单位 AS nvarchar(100)),
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)'),
         CAST(0 AS decimal(18,4)),
         CAST(数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(单据金额 AS decimal(18,4)),
         CAST(NULL AS decimal(18,4)),
         CAST(NULL AS decimal(18,4)),
         CAST(往来单位 AS nvarchar(200)),
         CAST(NULL AS nvarchar(200)),
         CAST(经手人 AS nvarchar(200))
    FROM dbo.outh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
) m
-- 坑2:必须单行兜底。写成 LEFT JOIN 会因 bs_wh 同名多行把流水行翻倍(实测 62 vs 31)
OUTER APPLY (SELECT TOP 1 x.仓库编码 FROM dbo.bs_wh x WHERE x.仓库名称 = m.仓库名称 ORDER BY x.id) w;
GO

-- ③ 视图注明(DROP VIEW 会连带删掉扩展属性,必须重写)
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_movement') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_movement';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存流水:读流水表 inh/outh(2026-09-30 起;原为 8 类单据表 UNION,仅已审核动作写入流水,故本视图口径=以流水为准)。仓库键=自身编码→bs_wh按名称兜底→#名称;批号空值归(未填批号);含税金额/税额恒为 NULL(流水表无此两列)',
     N'schema',N'dbo',N'view',N'v_stock_movement';
GO

-- ④ 自检(PRINT 走 warning code 0,DbSync 不回显;要看数字用配套探针
--    tools/archive/_verify-stock-movement-2026-09-30.java)
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.v_stock_movement'));
DECLARE @n int = (SELECT COUNT(*) FROM dbo.v_stock_movement);
DECLARE @nullRid int = (SELECT COUNT(*) FROM dbo.v_stock_movement WHERE rid IS NULL);
DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT src, rid FROM dbo.v_stock_movement GROUP BY src, rid HAVING COUNT(*) > 1) t);
-- 用 sys.sql_modules 而不是 OBJECT_DEFINITION:yinjia 账号读前者已有既有探针佐证可用
DECLARE @legacy int = CASE WHEN EXISTS(SELECT 1 FROM sys.sql_modules
                                        WHERE object_id = OBJECT_ID('dbo.v_stock_movement')
                                          AND definition LIKE '%bl_purchase_in%') THEN 1 ELSE 0 END;
PRINT N'[自检] v_stock_movement = ' + CAST(@cols AS nvarchar(4)) + N' 列 / ' + CAST(@n AS nvarchar(10)) + N' 行'
    + N'; rid 为空 ' + CAST(@nullRid AS nvarchar(4)) + N' 行; 重复 (src,rid) ' + CAST(@dup AS nvarchar(4))
    + N' 组; 仍引用 bl_purchase_in = ' + CAST(@legacy AS nvarchar(2));
IF @cols = 23 AND @nullRid = 0 AND @dup = 0 AND @legacy = 0
  PRINT N'[OK] 自检通过:23 列 + rid 全非空 + (src,rid) 无重复 + 已不再引用单据表';
ELSE
  RAISERROR(N'[FAIL] 自检异常(见上一行数字)', 16, 1);
GO
