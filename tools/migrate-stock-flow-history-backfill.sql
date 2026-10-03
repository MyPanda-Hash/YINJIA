/* =============================================================================
   migrate-stock-flow-history-backfill.sql
   —— 补写「迁移前已审核」的历史单据流水(库存三表重构的漏项收口)

   【问题】2026-10-03 拉取远端重构后实测:库存台账/库存状况表/收发存汇总**三个面板**都只剩
     期初行,期间单据一条不显示;收发存汇总查 2026 年期次「找不到数据」。

   【根因】v_stock_movement 从「现场 8 路 UNION 拼 8 张单据表」改成「只读流水表 inh/outh」
     (治 65s 超时的正解),但流水**只由过账动作写入** —— 迁移之前就已经审核的单据
     从来没写过流水。远端判定这个代价为 0(依据「8 张 bd_* 头表合计 0 行」),
     而**本机不是 0**:采购入库 119 行 + 销售出库 123 行,覆盖 86 个「仓库×存货」键。

   【本脚本做两件事】
     ① 把那些历史已审核单据行**按迁移前旧视图 (tools/migrate-inv-report-fields.sql) 的
        逐列口径**补写成流水 —— 含 src(段号)/rid(=bl_*.id)一一对应,
        这样弃审红冲、成本重算(InvCostService 按 (单据日期,src,rid) 递归)才认得出它们;
     ② 撤掉**由 kucun 快照生成的期初行**(src=0,单据类型='期初结存',经手人='migration',
        单据编号 LIKE 'INIT-%')。理由见下。

   【为什么要撤期初】期初是任务 2「期初建账单」按 kucun 现值生成的快照。在本机:
     · kucun 只有 7 条非零余量(合计 7,010),是**遗留残缺余额**;
     · 而历史单据净额是 38,076 —— 两者不同源。
     保留期初会和补进来的历史单据**双计**(实测:YJ-SX-031 期初 4500 + 单据 4600 = 9100)。
     迁移前报表本就是纯单据口径(无期初),撤掉期初 + 补历史 = **与迁移前报表逐行一致**。
     ⚠ 连带:启动自检「结存(kucun) == Σ流水」会对 kucun 覆盖不到的键告警 —— 那是
       kucun 本就残缺的真实反映(迁移前也存在这个不一致,只是当时没有这个自检)。

   【幂等】按 (src, rid) 判重:已有流水即跳过;期初删除带"该键已有历史流水"守卫。
     两账套都执行。可重复跑。

   【依赖】migrate-stock-flow-tables / -index-filter / -opening / -tax-cols 已执行。
   ============================================================================= */
SET NOCOUNT ON;
-- inh/outh 上有**过滤索引** ⇒ DML 必须在 QUOTED_IDENTIFIER ON 下(否则报 1934)
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.inh', N'src') IS NULL
BEGIN
  PRINT N'[SKIP] inh 还是旧结构(无 src 列),先跑 migrate-stock-flow-tables-2026-09-30.sql';
  RETURN;
END
GO

PRINT N'==== ① 补写历史入库流水(inh:src 1..4) ====';
GO

-- ── 1 采购入库单(入库 +)──────────────────────────────────────────────
INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 含税金额, 税额, 往来单位, 经手人,
                 asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 1, l.id, l.单据编号, N'采购入库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.存货名称, l.规格型号, l.计量单位,
       NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), l.仓库,
       COALESCE(NULLIF(RTRIM(CAST(l.批次号 AS nvarchar(60))),N''), NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.实收数量 AS decimal(18,4)), CAST(l.单价 AS decimal(18,6)),
       CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
       CAST(l.含税金额 AS decimal(18,4)),
       CAST(l.含税金额 - ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
       h.供应商, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核' OR ISNULL(h.单据状态2,'') = 'C'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM inh x WHERE x.src = 1 AND x.rid = l.id);
PRINT N'  采购入库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 2 产成品入库单(入库 +)────────────────────────────────────────────
INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 含税金额, 税额, 往来单位, 经手人,
                 asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 2, l.id, l.单据编号, N'产成品入库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.产品编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.产品名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.实收数量 AS decimal(18,4)), CAST(l.单价 AS decimal(18,6)),
       CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
       NULL, NULL, NULL, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='FINISH_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM inh x WHERE x.src = 2 AND x.rid = l.id);
PRINT N'  产成品入库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 3 其他入库单(入库 +)──────────────────────────────────────────────
INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 含税金额, 税额, 往来单位, 经手人,
                 asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 3, l.id, l.单据编号, N'其他入库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.存货名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.数量 AS decimal(18,4)), CAST(l.单价 AS decimal(18,6)),
       CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
       NULL, NULL, NULL, NULL,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OTHER_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM inh x WHERE x.src = 3 AND x.rid = l.id);
PRINT N'  其他入库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 4 委外入库单(入库 +)──────────────────────────────────────────────
INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                 仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 含税金额, 税额, 往来单位, 经手人,
                 asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 4, l.id, l.单据编号, N'委外入库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.产品编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.产品名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.实收数量 AS decimal(18,4)), CAST(l.单价 AS decimal(18,6)),
       CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
       NULL, NULL, NULL, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OUTSOURCE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM inh x WHERE x.src = 4 AND x.rid = l.id);
PRINT N'  委外入库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== ② 补写历史出库流水(outh:src 5..8) ====';
GO

-- ── 5 销售出库单(出库 −)──────────────────────────────────────────────
INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                  仓库编码, 仓库名称, 批号, 数量, 单据金额, 含税金额, 税额, 往来单位, 经手人,
                  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 5, l.id, l.单据编号, N'销售出库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.存货名称, l.规格型号, l.计量单位,
       NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.数量 AS decimal(18,4)),
       CAST(ISNULL(l.销售金额, l.售价 * l.数量) AS decimal(18,4)),
       CAST(l.含税销售金额 AS decimal(18,4)), CAST(l.税额 AS decimal(18,4)),
       h.客户, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核' OR ISNULL(h.单据状态2,'') = 'C'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM outh x WHERE x.src = 5 AND x.rid = l.id);
PRINT N'  销售出库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 6 材料出库单(出库 −)──────────────────────────────────────────────
INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                  仓库编码, 仓库名称, 批号, 数量, 单据金额, 含税金额, 税额, 往来单位, 经手人,
                  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 6, l.id, l.单据编号, N'材料出库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.材料编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.材料名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.数量 AS decimal(18,4)),
       CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
       NULL, NULL, NULL, NULL,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='MATERIAL_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM outh x WHERE x.src = 6 AND x.rid = l.id);
PRINT N'  材料出库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 7 其他出库单(出库 −)──────────────────────────────────────────────
INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                  仓库编码, 仓库名称, 批号, 数量, 单据金额, 含税金额, 税额, 往来单位, 经手人,
                  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 7, l.id, l.单据编号, N'其他出库单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.存货名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.数量 AS decimal(18,4)),
       CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
       NULL, NULL, NULL, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OTHER_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM outh x WHERE x.src = 7 AND x.rid = l.id);
PRINT N'  其他出库补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

-- ── 8 委外发料单(出库 −)──────────────────────────────────────────────
INSERT INTO outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                  仓库编码, 仓库名称, 批号, 数量, 单据金额, 含税金额, 税额, 往来单位, 经手人,
                  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT 8, l.id, l.单据编号, N'委外发料单', h.单据日期,
       ISNULL(NULLIF(RTRIM(CAST(l.材料编码 AS nvarchar(200))),N''), N'(未填存货)'),
       l.材料名称, l.规格型号, l.计量单位,
       NULL, l.仓库,
       ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''), N'(未填批号)'),
       CAST(l.数量 AS decimal(18,4)),
       CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
       NULL, NULL, NULL, h.经手人,
       N'migration-backfill', GETDATE(), N'历史单据补写', GETDATE(), N'N'
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号 = h.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
   AND (h.单据状态 = N'已审核'
        OR EXISTS (SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OUTSOURCE_ISSUE' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
   AND NOT EXISTS (SELECT 1 FROM outh x WHERE x.src = 8 AND x.rid = l.id);
PRINT N'  委外发料补写 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== ③ 撤掉 kucun 快照期初(仅限其键已被历史流水覆盖的) ====';
GO
-- 守卫:只删「由任务 2 生成」的期初(单据类型/经手人/单号三条件),且该 (仓库编码,物料编码)
-- 已经有入库流水 —— 没有历史流水的键保留期初(否则会把余额凭空清零)。
DELETE FROM inh
 WHERE src = 0
   AND 单据类型 = N'期初结存'
   AND 经手人 = N'migration'
   AND 单据编号 LIKE N'INIT-%'
   AND EXISTS (SELECT 1 FROM inh x
                WHERE x.src BETWEEN 1 AND 4
                  AND ISNULL(RTRIM(x.仓库编码),N'') = ISNULL(RTRIM(inh.仓库编码),N'')
                  AND RTRIM(x.物料编码) = RTRIM(inh.物料编码));
PRINT N'  撤期初 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(其余期初行保留)';
GO

PRINT N'==== 自检 ====';
GO
SELECT N'流水按段分布' AS 检查, src, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,4)) AS 数量合计
  FROM (SELECT src, 数量 FROM inh UNION ALL SELECT src, 数量 FROM outh) t
 GROUP BY src ORDER BY src;
GO
SELECT N'三个报表视图行数(补写后应出现期间单据)' AS 检查,
       (SELECT COUNT(*) FROM v_stock_movement) AS 流水视图行数,
       (SELECT COUNT(*) FROM v_stock_ledger)   AS 台账行数,
       (SELECT COUNT(*) FROM v_stock_balance)  AS 状况表行数,
       (SELECT COUNT(*) FROM v_stock_summary)  AS 汇总行数;
GO
SELECT N'勾稽:流水净额 vs kucun 余量(不一致为遗留 kucun 残缺,非本脚本引入)' AS 检查,
       (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y')
     - (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量;
GO
PRINT N'migrate-stock-flow-history-backfill 完成(⚠ 成本物化表需重算:启动自检会自动跑,或点面板「重算成本」)';
GO
