-- migrate-stock-flow-src-rid-grain-20261020.sql
-- 库存流水「唯一键粒度」放细:三张表/两个视图跟着改,一处不改就断链。
--   (src, rid) → (src, rid, 物料编码, 批号)   [inh/outh 唯一索引 + inv_cost_ledger 主键 + 两个报表视图的 JOIN]
-- 幂等,两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST);每段末尾都有自检表可看结论。
--
-- ── 起因(用户 2026-10-20 报障,原话)─────────────────────────────────────────
--   「你们限定了一个工单只能领一次料,换没领过料的工单就可以了,应该是把你们设定的哪个唯一性拿掉,就彻底解决了」
--   「我们有个扫码领料的小程序,扫码领料有出现限制,一个工单是可以扫多个物料的,一个工单因为有多个物料组合」
--   现场报错(截图原样):
--     error 2601:不能在具有唯一索引"UX_outh_src_rid"的对象"dbo.outh"中插入重复键的行。重复键值为 (6, 1711)。
--
-- ── 机理 ─────────────────────────────────────────────────────────────────
--   扫码领料小程序写 outh 时,rid 取的是「工单/工单行」级别的 id(同一个工单的多种物料共用一条来源行),
--   而唯一键当时只有 (src, rid) ⇒ 该工单扫第二件物料时必然撞键。MES 自己的写入口
--   (StockFlowService,rid = bl_*.id 单据明细行)天然「一行一个物料」,所以一直没暴露。
--
-- ── 改法(为什么不是"把唯一性整个拿掉")────────────────────────────────────
--   唯一索引是「结存 == Σ流水」的最后一道保险(见 StockFlowService 头注)。整条拿掉,
--   post 的存在性判断哪天出 bug 就是静默重复扣账。故只把**粒度**放细到
--   「一条来源行的同一个物料 + 同一个批号只准一条流水」:
--     · 一个工单领 N 种物料 ⇒ N 行,不再撞键(用户诉求);
--     · 同一单据行重复审核 / 重复扫码同物料同批号 ⇒ 仍只一行,不重复扣账;
--     · rid 为 NULL 的行(期初、月结转)仍被过滤索引排除,可任意多行 —— 与 2026-09-30 口径一致。
--
--   ⚠ 必须**四处同口径**,少改一处就断:
--     ① outh / inh 的唯一索引(本次 ①);
--     ② inv_cost_ledger 的主键(原本也是 (src,rid)) —— 否则同一 (src,rid) 多行时「重算成本」直接 2627,
--        实测:测试账套往 outh 塞一条 (src=6, rid=9, 另一物料) 后点「重算成本」→ HTTP 500 重复键 (6,9)(本次 ②);
--     ③ v_stock_ledger / v_stock_balance 的 `c.src = m.src AND c.rid = m.rid` 单键 JOIN ——
--        不补物料+批号会**行数翻倍**(成本金额被重复计入)(本次 ③);
--     ④ 代码 StockFlowService.post 的存在性判断/弃审/复活(同批代码改动,不在本脚本)。
--   索引名沿用 UX_*_src_rid(仓库多处注释/探针按名字找它),键列变了、名字没变。
--
-- 执行记录(2026-10-20):HSDZ_MES / HSDZ_MES_TEST 均「执行 1、失败 0」,复跑「执行 0」。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ═════════ ① inh / outh 唯一索引放细 ═════════
   判据:索引存在且**恰好 2 个键列** = 旧粒度,重建;已是 4 键列 = 跳过(幂等)。 */
DECLARE @rebuildOut bit = 0;
IF EXISTS (SELECT 1 FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.outh') AND i.name = 'UX_outh_src_rid'
              AND (SELECT COUNT(*) FROM sys.index_columns ic
                    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                      AND ic.is_included_column = 0) = 2)
  SET @rebuildOut = 1;
IF @rebuildOut = 1 DROP INDEX UX_outh_src_rid ON dbo.outh;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.outh') AND name = 'UX_outh_src_rid')
    CREATE UNIQUE INDEX UX_outh_src_rid ON dbo.outh (src, rid, 物料编码, 批号) WHERE rid IS NOT NULL;

DECLARE @rebuildIn bit = 0;
IF EXISTS (SELECT 1 FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.inh') AND i.name = 'UX_inh_src_rid'
              AND (SELECT COUNT(*) FROM sys.index_columns ic
                    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                      AND ic.is_included_column = 0) = 2)
  SET @rebuildIn = 1;
IF @rebuildIn = 1 DROP INDEX UX_inh_src_rid ON dbo.inh;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.inh') AND name = 'UX_inh_src_rid')
    CREATE UNIQUE INDEX UX_inh_src_rid ON dbo.inh (src, rid, 物料编码, 批号) WHERE rid IS NOT NULL;
GO

/* ═════════ ② inv_cost_ledger 主键同口径 ═════════
   旧 PK (src, rid) 会让「同一来源行多物料」在重算成本时撞键(2627)。改到 4 键。
   ⚠ 键长:存货编码 nvarchar(400)=800B + 批号 nvarchar(120)=240B + src/rid 8B ≈ 1048B > 聚簇键上限 900B
     ⇒ PK 必须是**非聚簇**(上限 1700B),表随之从「聚簇表」退化为堆。全表 ~5000 行,查询走 PK / IX_part 都不受影响。 */
DECLARE @pkLong bit = 0;
IF EXISTS (SELECT 1 FROM sys.key_constraints k
             JOIN sys.indexes i ON i.object_id = k.parent_object_id AND i.index_id = k.unique_index_id
            WHERE k.name = 'PK_inv_cost_ledger' AND k.parent_object_id = OBJECT_ID('dbo.inv_cost_ledger')
              AND (SELECT COUNT(*) FROM sys.index_columns ic
                    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                      AND ic.is_included_column = 0) = 2)
  SET @pkLong = 1;
IF @pkLong = 1 ALTER TABLE dbo.inv_cost_ledger DROP CONSTRAINT PK_inv_cost_ledger;

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_inv_cost_ledger'
                AND parent_object_id = OBJECT_ID('dbo.inv_cost_ledger'))
  ALTER TABLE dbo.inv_cost_ledger
    ADD CONSTRAINT PK_inv_cost_ledger PRIMARY KEY NONCLUSTERED (src, rid, 存货编码, 批号);
GO

/* ═════════ ③ 两个报表视图改成 4 键 JOIN ═════════
   只改 `ON c.src = m.src AND c.rid = m.rid` 这一处(补 存货编码 + 批号),
   其余表达式与 2026-10-16(migrate-stock-views-restore-20261016.sql)/ 2026-10-18
   (migrate-stock-balance-warn-20261018.sql)两版**逐字一致** —— 那两份历史脚本不再动(动了会被 DbSync 重跑)。 */
CREATE OR ALTER VIEW dbo.v_stock_ledger AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库键, m.存货编码, m.单据日期, m.src, m.rid) AS id,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 开始日期,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 结束日期,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.单据日期, m.单据类型, m.单据编号, m.业务类型, m.往来单位, m.往来单位编码, m.经手人,
       ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 AS 期初数量,
       CASE WHEN ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 <> 0
            THEN (ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0))
                 / (ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量)
            ELSE 0 END AS 期初平均单价,
       ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0) AS 期初金额,
       m.收入数量,
       CASE WHEN m.收入数量<>0 THEN m.收入金额/m.收入数量 ELSE 0 END AS 收入单价,
       m.收入金额,
       m.含税金额, m.税额,
       m.发出数量,
       CASE WHEN m.发出数量<>0 THEN ISNULL(c.发出成本金额,0)/m.发出数量 ELSE 0 END AS 发出单价,
       ISNULL(c.发出成本金额,0) AS 发出金额,
       m.发出单据金额,
       ISNULL(c.结存数量,0) AS 期末数量,
       ISNULL(c.移动加权单价,0) AS 期末平均单价,
       ISNULL(c.结存金额,0) AS 期末金额,
       CAST('N' AS char(1)) AS asp_cancel
FROM dbo.v_stock_movement m
LEFT JOIN dbo.inv_cost_ledger c
       ON c.src = m.src AND c.rid = m.rid AND c.存货编码 = m.存货编码 AND c.批号 = m.批号;
GO

/* CREATE VIEW / ALTER VIEW 必须是批次里的第一条语句 ⇒ 两张视图各占一批(不能合并)。 */
CREATE OR ALTER VIEW dbo.v_stock_balance AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库, m.存货编码, m.存货) AS id,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
       SUM(m.数量*m.sign) AS 现存量,
       CASE WHEN SUM(m.数量*m.sign)<>0 THEN SUM(m.金额*m.sign)/SUM(m.数量*m.sign) ELSE 0 END AS 结存单价,
       SUM(m.金额*m.sign) AS 结存金额,
       ISNULL(MAX(k.预警数量),0) AS 预警数量,
       CAST('N' AS char(1)) AS asp_cancel
FROM (
  -- 在库:现存量按 仓库键+存货 聚合;金额 = 收入金额 − 移动加权发出成本(取自物化表)
  SELECT m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位 AS 主计量,
         m.收入数量 - m.发出数量 AS 数量,
         m.收入金额 - ISNULL(c.发出成本金额,0) AS 金额, 1 AS sign
  FROM dbo.v_stock_movement m
  LEFT JOIN dbo.inv_cost_ledger c
         ON c.src = m.src AND c.rid = m.rid AND c.存货编码 = m.存货编码 AND c.批号 = m.批号
) m
-- 预警数量:遗留批次表 kucun 按 仓库+存货 聚合(同一组合阈值唯一;无阈值的行补 0)
LEFT JOIN (
  SELECT RTRIM(wzdm) AS 存货编码, RTRIM(ckdm) AS 仓库编码, MAX(ISNULL(预警数量,0)) AS 预警数量
  FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(预警数量,0) > 0
  GROUP BY RTRIM(wzdm), RTRIM(ckdm)
) k ON k.存货编码 = m.存货编码 AND k.仓库编码 = m.仓库编码
-- 与成本分区键同口径(含 仓库键):否则同编码不同名称写法会被拆成两行,与成本口径不一致
GROUP BY m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量;
GO

/* ═════════ ④ 列/表中文注明跟着改(注明写的是键口径,不改就是错的)═════════
   ⚠ 查扩展属性必须带 ep.class = 1(规范铁律:否则索引 index_id 撞上备用列 column_id 会静默漏写)。 */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            WHERE ep.class = 1 AND ep.major_id = OBJECT_ID('dbo.outh')
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.outh'), 'rid', 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
         N'来源单据行 id(bl_*.id);与 src + 物料编码 + 批号 组成唯一键(2026-10-20 放宽:同一来源行可有多物料/多批号;重复审核同物料同批号仍只记一次)。期初/月结转行为 NULL',
         N'SCHEMA', N'dbo', N'TABLE', N'outh', N'COLUMN', N'rid';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
         N'来源单据行 id(bl_*.id);与 src + 物料编码 + 批号 组成唯一键(2026-10-20 放宽:同一来源行可有多物料/多批号;重复审核同物料同批号仍只记一次)。期初/月结转行为 NULL',
         N'SCHEMA', N'dbo', N'TABLE', N'outh', N'COLUMN', N'rid';

IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            WHERE ep.class = 1 AND ep.major_id = OBJECT_ID('dbo.inh')
              AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.inh'), 'rid', 'ColumnId') AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
         N'来源单据行 id(bl_*.id);与 src + 物料编码 + 批号 组成唯一键(2026-10-20 放宽:同一来源行可有多物料/多批号;重复审核同物料同批号仍只记一次)。期初/月结转行为 NULL',
         N'SCHEMA', N'dbo', N'TABLE', N'inh', N'COLUMN', N'rid';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
         N'来源单据行 id(bl_*.id);与 src + 物料编码 + 批号 组成唯一键(2026-10-20 放宽:同一来源行可有多物料/多批号;重复审核同物料同批号仍只记一次)。期初/月结转行为 NULL',
         N'SCHEMA', N'dbo', N'TABLE', N'inh', N'COLUMN', N'rid';
GO

/* ═════════ ⑤ 自检(结论直接看最后这张表)═════════ */
WITH x AS (
  SELECT t.表, i.name AS 索引, i.is_unique, i.has_filter,
         STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                   ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                  WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                  ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
    FROM (SELECT N'outh' AS 表 UNION ALL SELECT N'inh') t
    JOIN sys.indexes i ON i.object_id = OBJECT_ID('dbo.' + t.表) AND i.name = N'UX_' + t.表 + N'_src_rid'
)
SELECT 表 AS 对象, N'唯一索引' AS 类别, 键列,
       CASE WHEN is_unique = 1 AND has_filter = 1 AND 键列 = N'src,rid,物料编码,批号'
            THEN N'[PASS]' ELSE N'[FAIL]' END AS 结论
  FROM x
UNION ALL
SELECT N'inv_cost_ledger', N'主键',
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                 ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, ''),
       CASE WHEN EXISTS (SELECT 1 FROM sys.key_constraints k JOIN sys.indexes i2
                          ON i2.object_id = k.parent_object_id AND i2.index_id = k.unique_index_id
                         WHERE k.name = 'PK_inv_cost_ledger'
                           AND (SELECT COUNT(*) FROM sys.index_columns ic
                                 WHERE ic.object_id = i2.object_id AND ic.index_id = i2.index_id
                                   AND ic.is_included_column = 0) = 4)
            THEN N'[PASS]' ELSE N'[FAIL]' END
  FROM sys.indexes i
 WHERE i.object_id = OBJECT_ID('dbo.inv_cost_ledger') AND i.name = 'PK_inv_cost_ledger'
UNION ALL
SELECT N'v_stock_ledger / v_stock_balance', N'视图 JOIN',
       N'存货编码 + 批号',
       CASE WHEN (SELECT COUNT(*) FROM sys.sql_modules m
                   WHERE m.object_id IN (OBJECT_ID('dbo.v_stock_ledger'), OBJECT_ID('dbo.v_stock_balance'))
                     AND m.definition LIKE N'%c.存货编码 = m.存货编码%') = 2
            THEN N'[PASS]' ELSE N'[FAIL]' END;
