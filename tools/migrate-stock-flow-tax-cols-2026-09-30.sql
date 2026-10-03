-- migrate-stock-flow-tax-cols-2026-09-30.sql
-- 任务 7:给流水表 inh/outh 补 [含税金额]/[税额] 两列,并让 v_stock_movement **透传**这两列
-- (改前是 CAST(NULL AS decimal(18,4)) ⇒ 恒 NULL ⇒ 库存台账面板 STOCK_LEDGER 这两列永远空白)
-- —— 幂等,两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)
-- ⚠ inh/outh 上有**过滤索引**(UX_*_src_rid ... WHERE rid IS NOT NULL);ALTER TABLE 在
--   QUOTED_IDENTIFIER OFF 的会话下会报 error 1934 —— 显式打开(sqlcmd 用 -I;DbSync 走 JDBC 本就是 ON)
SET QUOTED_IDENTIFIER ON;
GO
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   【为什么要这个脚本】任务 4 把 v_stock_movement 改成读流水表时,这两列按计划写成
   CAST(NULL AS decimal(18,4)) ⇒ 视图能查,但**恒为 NULL**。而库存台账面板(STOCK_LEDGER)
   的这两个字段是 visible=1 ⇒ 用户会看到两列永远空白,以为坏了。
   数据本来是有的(旧视图的 8 路 UNION 里,采购入库/销售出库两段取过这两列)。

   【口径:逐列照抄旧视图(migrate-inv-report-fields.sql §1)】
     · 采购入库(src=1):含税金额 = bl_purchase_in.含税金额;
                        税额     = 含税金额 − ISNULL(金额, 单价×实收数量)   ← **反推**
                        (bl_purchase_in **没有** 税额 列 —— 实测 sys.columns,只有 税率%/含税单价/金额/含税金额)
     · 销售出库(src=5):含税金额 = bl_sale_out.含税销售金额(列名不同!);
                        税额     = bl_sale_out.税额(原样列)
     · 其余 6 段(产成品入库/其他入库/委外入库/材料出库/其他出库/委外发料):旧视图这两段就是 NULL
       (那 6 张行表也没有这两列)⇒ 保持 NULL,不臆造。
   注:本期初行(src=0,任务 2 建账单)也没有这两列 ⇒ 保持 NULL(与旧视图对期初的处理一致)。

   【为什么不改任务 1 的脚本】DbSync 按**内容哈希**判重跑:改动已提交的
   migrate-stock-flow-tables-2026-09-30.sql 一个字节,下次 sync 就会把它"重跑"
   (历史脚本重跑会撞 schema 演进)。故加列走本新文件。

   【列契约:23 列逐列不变】本脚本只把 含税金额/税额 两列的**值来源**从 NULL 换成透传,
   列名/顺序/类型一个字母都不动 ⇒ 下游 v_stock_ledger / v_stock_summary / v_stock_balance
   与 InvCostService 一行都不用改。脚本末尾的自检会把**列名顺序**与写死的契约串逐字比对。

   【成本与勾稽不受影响】这两列不参与任何金额聚合(v_stock_balance 的现存量/结存金额只用
   收入数量/发出数量/收入金额/发出成本金额)⇒ 勾稽数字不变。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ⓪ 前置校验:流水表就位才动它。不满足就让本批抛错 ——
--    DbSync 遇 SQLException 会**中止整个文件**(后续批不再执行),库保持在"改动前"的一致状态。
IF COL_LENGTH('dbo.inh', N'src') IS NULL OR COL_LENGTH('dbo.outh', N'src') IS NULL
  RAISERROR(N'[FAIL] inh/outh 还不是 MES 流水表(缺 src 列),请先执行 migrate-stock-flow-tables-2026-09-30.sql。本脚本未改动任何对象', 16, 1);
GO

-- ① 加列(幂等:先判后加;两列分开判,部分执行过也能收敛)
IF COL_LENGTH('dbo.inh', N'含税金额') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [含税金额] decimal(18,4) NULL;
  PRINT N'[OK] inh.[含税金额] 已添加';
END
ELSE PRINT N'[SKIP] inh.[含税金额] 已存在';
GO
IF COL_LENGTH('dbo.inh', N'税额') IS NULL
BEGIN
  ALTER TABLE dbo.inh ADD [税额] decimal(18,4) NULL;
  PRINT N'[OK] inh.[税额] 已添加';
END
ELSE PRINT N'[SKIP] inh.[税额] 已存在';
GO
IF COL_LENGTH('dbo.outh', N'含税金额') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [含税金额] decimal(18,4) NULL;
  PRINT N'[OK] outh.[含税金额] 已添加';
END
ELSE PRINT N'[SKIP] outh.[含税金额] 已存在';
GO
IF COL_LENGTH('dbo.outh', N'税额') IS NULL
BEGIN
  ALTER TABLE dbo.outh ADD [税额] decimal(18,4) NULL;
  PRINT N'[OK] outh.[税额] 已添加';
END
ELSE PRINT N'[SKIP] outh.[税额] 已存在';
GO

-- ② 列级中文注明(与 migrate-stock-flow-tables §④ 同款幂等写法;⚠ 判存在必须带 ep.class = 1,
--    否则某索引的 index_id 撞上列 id 会误判"已有注明"而静默漏写 —— 见《数据库规范》踩坑注记)
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 ('inh',  N'含税金额', N'含税金额(采购入库 = bl_purchase_in.含税金额 原样;其余入库段为 NULL)。由 StockLedgerService.loadRows 取值、StockFlowService.postFlow 写入;v_stock_movement 透传'),
 ('inh',  N'税额',     N'税额(采购入库 = 含税金额 − ISNULL(金额, 单价×实收数量) **反推** —— bl_purchase_in 没有税额列;其余入库段为 NULL)'),
 ('outh', N'含税金额', N'含税金额(销售出库 = bl_sale_out.含税销售金额 原样;其余出库段为 NULL)'),
 ('outh', N'税额',     N'税额(销售出库 = bl_sale_out.税额 原样;其余出库段为 NULL)');
DECLARE @t sysname, @c sysname, @n nvarchar(400);
DECLARE cur CURSOR FOR SELECT tbl, col, note FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                WHERE ep.major_id = OBJECT_ID(@t) AND ep.class = 1
                  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId') AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @t, @c, @n;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] inh/outh 新增列的列级中文注明已写入(4 条)';
GO

-- ③ 视图:新列就位后才 DROP(否则视图删了建不回来,下游三个视图会直接报"对象不存在")
IF COL_LENGTH('dbo.inh', N'含税金额') IS NULL OR COL_LENGTH('dbo.inh', N'税额') IS NULL
   OR COL_LENGTH('dbo.outh', N'含税金额') IS NULL OR COL_LENGTH('dbo.outh', N'税额') IS NULL
  RAISERROR(N'[FAIL] 四个新列未全部就位,不改视图(避免视图被删后建不回来)', 16, 1);
GO
IF OBJECT_ID('dbo.v_stock_movement') IS NOT NULL DROP VIEW dbo.v_stock_movement;
GO
-- 新定义:与 migrate-stock-movement-from-flow-2026-09-30.sql 的定义**逐字相同**,
-- 只把两处 `CAST(NULL AS decimal(18,4))`(含税金额/税额)换成对流水表新列的 CAST 透传。
-- ⚠ 两份定义必须一致,改动请同步(那边头部有交叉引用;DbSync 按哈希判重跑,故不能合并成一个文件)。
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
         -- 期初行 rid 为 NULL ⇒ 用流水行自身 id 作合成键(见任务 4 的「rid 的两处坑」坑1)
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
         -- 任务 7:透传(改前是 CAST(NULL AS decimal(18,4)),故这两列恒 NULL)
         CAST(含税金额 AS decimal(18,4)) AS 含税金额,
         CAST(税额 AS decimal(18,4)) AS 税额,
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
         -- 任务 7:透传(同入库段)
         CAST(含税金额 AS decimal(18,4)),
         CAST(税额 AS decimal(18,4)),
         CAST(往来单位 AS nvarchar(200)),
         CAST(NULL AS nvarchar(200)),
         CAST(经手人 AS nvarchar(200))
    FROM dbo.outh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
) m
-- 坑2:必须单行兜底。写成 LEFT JOIN 会因 bs_wh 同名多行把流水行翻倍(实测 62 vs 31)
OUTER APPLY (SELECT TOP 1 x.仓库编码 FROM dbo.bs_wh x WHERE x.仓库名称 = m.仓库名称 ORDER BY x.id) w;
GO

-- ④ 视图注明(DROP VIEW 会连带删掉扩展属性,必须重写)
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_movement') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_movement';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存流水:读流水表 inh/outh(2026-09-30 起;原为 8 类单据表 UNION,仅已审核动作写入流水,故本视图口径=以流水为准)。仓库键=自身编码→bs_wh按名称兜底→#名称;批号空值归(未填批号);含税金额/税额 由流水表透传(2026-10-03 任务 7 起;此前恒为 NULL):采购入库段=单据含税金额与反推税额,销售出库段=单据含税销售金额与税额,其余段与期初为 NULL',
     N'schema',N'dbo',N'view',N'v_stock_movement';
GO

-- ⑤ 自检:① 两个新列各就位;② 视图仍是 23 列;③ **列名与顺序逐字**等于契约串;
--         ④ 视图定义里已不含 `NULL AS decimal(18,4)`(即这两列不再恒 NULL)
--    注:PRINT 走 warning 码 0,DbSync **不回显**;要看这些数字用配套探针
--        tools/archive/_verify-stock-movement-2026-09-30.java(先 dry 后 check)
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.v_stock_movement'));
DECLARE @contract nvarchar(400) = N'src,rid,单据日期,单据类型,单据编号,业务类型,仓库键,仓库编码,仓库,存货编码,存货,规格型号,计量单位,批号,收入数量,发出数量,收入金额,发出单据金额,含税金额,税额,往来单位,往来单位编码,经手人';
DECLARE @actual nvarchar(400) = STUFF((SELECT N',' + c.name FROM sys.columns c
                                        WHERE c.object_id = OBJECT_ID('dbo.v_stock_movement')
                                        ORDER BY c.column_id FOR XML PATH(N''), TYPE).value(N'.', N'nvarchar(400)'), 1, 1, N'');
DECLARE @def nvarchar(max) = (SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.v_stock_movement'));
-- ⚠ 判「定义里还有没有 NULL AS decimal(18,4)」**必须先剥掉行注释**:视图定义会把 `-- 注释` 原样存进
--   sys.sql_modules.definition,而本脚本的注释里恰好写了「改前是 CAST(NULL AS decimal(18,4))」——
--   不剥注释的 LIKE 会**假报 FAIL**(dry 预演实测踩到:视图其实已经透传了,自检却报 stillNull=1)。
--   本库 compat level=100 ⇒ 没有 STRING_SPLIT,只能自己按 CHAR(10) 逐行切。
DECLARE @code nvarchar(max) = N'', @rest nvarchar(max) = ISNULL(@def, N''), @nl int, @ln nvarchar(max);
WHILE LEN(@rest) > 0
BEGIN
  SET @nl = CHARINDEX(CHAR(10), @rest);
  SET @ln = CASE WHEN @nl = 0 THEN @rest ELSE LEFT(@rest, @nl - 1) END;
  IF LTRIM(RTRIM(@ln)) NOT LIKE N'--%' SET @code = @code + @ln + N' ';
  SET @rest = CASE WHEN @nl = 0 THEN N'' ELSE SUBSTRING(@rest, @nl + 1, LEN(@rest)) END;
END
DECLARE @stillNull int = CASE WHEN @code LIKE N'%NULL AS decimal(18,4)%' THEN 1 ELSE 0 END;
DECLARE @newCols int = CASE WHEN COL_LENGTH('dbo.inh', N'含税金额') IS NOT NULL AND COL_LENGTH('dbo.inh', N'税额') IS NOT NULL
                             AND COL_LENGTH('dbo.outh', N'含税金额') IS NOT NULL AND COL_LENGTH('dbo.outh', N'税额') IS NOT NULL
                        THEN 4 ELSE 0 END;
PRINT N'[自检] 新列 ' + CAST(@newCols AS nvarchar(2)) + N'/4;视图 ' + CAST(@cols AS nvarchar(4)) + N' 列;'
    + N'列名与顺序一致 = ' + CASE WHEN @actual = @contract THEN N'是' ELSE N'否' END
    + N';视图内仍有 NULL AS decimal(18,4) = ' + CAST(@stillNull AS nvarchar(2));
IF @newCols = 4 AND @cols = 23 AND @actual = @contract AND @stillNull = 0
  PRINT N'[OK] 自检通过:4 个新列就位 + 视图 23 列且列名顺序逐字不变 + 含税金额/税额 已透传(不再恒 NULL)';
ELSE
  RAISERROR(N'[FAIL] 自检异常(见上一行数字):列契约必须 23 列且顺序不变', 16, 1);
GO
