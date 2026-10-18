/* =============================================================================
   backfill-stock-flow-imported.sql — 给「本次导库进来的金蝶单据」补写库存流水(inh/outh)

   【为什么需要】库存流水只由**应用的过账动作**写入(StockLedgerService/StockFlowService,
   审核时同事务写 kucun + inh/outh)。本次 DATA 导入是**直接写库**、绕过应用,于是:
     · 单据在(采购入库 313 / 销售出库 415 / 材料出库 487 / 产成品入库 232 / 其他入 14 / 其他出 79),
     · yj_doc_status 留痕也在(界面显示「已审核」),
     · 但 inh 只有 31 行期初、outh **0 行** ⇒ 桌面「库存」卡片读 inh/outh,所以只显示 1 条入库、出库为空。

   【本脚本】照抄 tools/migrate-stock-flow-history-backfill.sql 的**逐列原口径**,只保留现存 6 类单据段:
     inh  src=1 采购入库 / 2 产成品入库 / 3 其他入库
     outh src=5 销售出库 / 6 材料出库 / 7 其他出库
   ⚠ 原迁移脚本已**过期**:它的 src=4 委外入库 / src=8 委外发料 两段引用
     bl_outsource_in / bl_outsource_issue —— 这两张表 2026-10-08 随面板下架已删除,
     整脚本会以「对象名 'bl_outsource_in' 无效」中止,故**不能直接重跑它**;本脚本即其现存段的等价替换。
     (已登记的迁移脚本一律不改:改字节会让 DbSync 按哈希判为重跑。)

   【幂等】按 (src, rid) 判重,已有的跳过;可重复执行。两账套都执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
   【执行】cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run archive\_kingdee-reimport-20261016\backfill-stock-flow-imported.sql
   ⚠ 本脚本**不要**登记进 tools/db-migrations.txt。
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;   -- inh/outh 上有过滤索引,DML 必须在此开关下(否则报 1934)
GO

PRINT N'==== ① 入库流水(inh:src 1..3) ====';
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

PRINT N'==== ② 出库流水(outh:src 5..7) ====';
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

PRINT N'==== ③ 撤掉 kucun 快照期初(仅限其键已被单据流水覆盖的,防与单据双计)====';
GO
-- 守卫与 migrate-stock-flow-history-backfill.sql ③ 逐字一致:
-- 只删「由期初建账单生成」的期初行(单据类型/经手人/单号三条件),且该 (仓库编码,物料编码) 已有入库流水。
DELETE FROM inh
 WHERE src = 0
   AND 单据类型 = N'期初结存'
   AND 经手人 = N'migration'
   AND 单据编号 LIKE N'INIT-%'
   AND EXISTS (SELECT 1 FROM inh x
                WHERE x.src BETWEEN 1 AND 4
                  AND ISNULL(RTRIM(x.仓库编码),N'') = ISNULL(RTRIM(inh.仓库编码),N'')
                  AND RTRIM(x.物料编码) = RTRIM(inh.物料编码));
PRINT N'  撤期初 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(未被单据覆盖的期初行保留)';
GO

PRINT N'==== 自检:流水按段分布 ====';
GO
SELECT src, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,4)) AS 数量合计
  FROM (SELECT src, 数量 FROM inh UNION ALL SELECT src, 数量 FROM outh) t
 GROUP BY src ORDER BY src;
GO
