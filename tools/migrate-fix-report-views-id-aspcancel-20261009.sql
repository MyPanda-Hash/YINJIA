-- migrate-fix-report-views-id-aspcancel-20261009.sql — 修复 3 个「报表视图缺 id/asp_cancel」导致面板打开即 500
--
-- 现象(2026-10-09 实测):`FINISH_IN_DETAIL`(产成品入库单明细表)/ `FINISH_IN_STATS`(产成品入库单统计表)
--   / `MANU_ORDER_STATS`(生产工单统计表)三个 flat 面板**一打开就 500**:
--     SELECT COUNT(*) FROM v_finish_in_detail t WHERE ISNULL(t.asp_cancel,'N')<>'Y'
--     → 列名 'asp_cancel' 无效。同样的守卫对 id(pk_col) 也生效。
--
-- 根因:实库这三张视图仍是**初版导入时期的旧定义**,缺 flat 报表视图的两项标配:
--   · `id`(面板 pk_col 指向它;报表视图统一用 ROW_NUMBER() 生成)
--   · `asp_cancel`(软删过滤列;面板查询恒带 ISNULL(t.asp_cancel,'N')<>'Y')
--   这三张视图当年被 `tools/_doc_part1_tables.sql` / 早期快照覆盖成了「无 id/无 asp_cancel」的版本,
--   而正确版本仍存于 tools/archive/_table-audit/viewdefs.tsv(2026-09-29 表定册时从**备用账套**导出的定义)。
--   证据:tools/archive/_normaudit-HSDZ_MES.out、_dbnorm-prod.out.txt、_normaudit-HSDZ_MES_TEST.out
--        早已逐条记录 `FINISH_IN_DETAIL → v_finish_in_detail 缺 id+asp_cancel`(DbNormAudit 存量 FAIL)。
--
-- 做法:**按 viewdefs.tsv 里的正确定义重建**这三张视图(逐字照抄,只加 id/asp_cancel 与 yj_doc_status 审核人关联;
--   列名与 `yj_field` 里这三张面板登记的字段**逐列对齐**——已核对 FINISH_IN_DETAIL 23 列 / FINISH_IN_STATS 12 列
--   / MANU_ORDER_STATS 9 列全部命中,无新增/改名列)。视图定义里的表列已逐列核对存在(sys.columns)。
--
-- 影响面:`v_manu_order_stats` 另有附带修复 —— 实库旧定义里 加工单数/计划数量/累计汇报数量/完工数量/生产进度%
--   五列恒为 NULL(旧定义是空壳),重建后恢复真实聚合(COUNT/SUM + 完工日期 CASE + 进度%);这正是面板字段登记的语义。
--
-- 幂等:CREATE OR ALTER VIEW,重跑结果一致。
-- 两账套都要执行(先正式、后测试):
--   正式 tools> java -cp lib\mssql-jdbc.jar DbSync.java run migrate-fix-report-views-id-aspcancel-20261009.sql
--   测试 tools> set YINJIA_SQL_DB=HSDZ_MES_TEST && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-fix-report-views-id-aspcancel-20261009.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库
GO
PRINT N'[库] ' + DB_NAME() + N' — 重建 3 个报表视图(补 id / asp_cancel)';
GO
-- ══ ① v_finish_in_detail(产成品入库单明细表;23 字段)══
IF OBJECT_ID('dbo.v_finish_in_detail','V') IS NOT NULL
EXEC(N'CREATE OR ALTER VIEW v_finish_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
       h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
       NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[入库类别],
       NULL AS [生产车间编码] /* 无数据源,布局列 */, h.[生产车间],
       NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.[备注],
       h.asp_user1 AS [制单人], s.shr AS [审核人],
       NULL AS [存货编码] /* 无数据源,布局列 */, l.[产品名称] AS [存货], l.[规格型号], l.[计量单位],
       l.[实收数量], l.[单价], l.[金额],
       NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [实收数量2] /* 无数据源,布局列 */
FROM bd_finish_in h
LEFT JOIN bl_finish_in l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = ''FINISH_IN'' AND s.doc_no = h.[单据编号]');
PRINT N'[视图] v_finish_in_detail 已重建';
GO
-- ══ ② v_finish_in_stats(产成品入库单统计表;12 字段)══
IF OBJECT_ID('dbo.v_finish_in_stats','V') IS NOT NULL
EXEC(N'CREATE OR ALTER VIEW v_finish_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
       h.[单据日期], h.[项目], NULL AS [存货编码],
       l.[产品名称] AS [存货], l.[规格型号], l.[计量单位], NULL AS [辅单位],
       SUM(COALESCE(l.[实收数量],0)) AS [实收数量(主单位)],
       SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[实收数量],0)),0) AS [单价],
       SUM(COALESCE(l.[金额],0)) AS [金额],
       NULL AS [实收数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_finish_in h
LEFT JOIN bl_finish_in l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ''FINISH_IN''
                    AND s.doc_no = h.[单据编号] AND s.canceled = ''Y'')
GROUP BY h.asp_cancel, h.[单据日期], h.[项目], l.[产品名称], l.[规格型号], l.[计量单位]');
PRINT N'[视图] v_finish_in_stats 已重建';
GO
-- ══ ③ v_manu_order_stats(生产工单统计表;9 字段;顺带把 5 个恒 NULL 列恢复为真实聚合)══
IF OBJECT_ID('dbo.v_manu_order_stats','V') IS NOT NULL
EXEC(N'CREATE OR ALTER VIEW v_manu_order_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
       l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位],
       COUNT(DISTINCT h.[合同号]) AS [加工单数],
       SUM(COALESCE(l.[数量],0)) AS [计划数量],
       SUM(COALESCE(l.[累计汇报套数(工序单位)],0)) AS [累计汇报数量],
       SUM(CASE WHEN h.[完工日期] IS NOT NULL THEN COALESCE(l.[数量],0) ELSE 0 END) AS [完工数量],
       CAST(ISNULL(100.0*SUM(COALESCE(l.[累计汇报套数(工序单位)],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0),0) AS decimal(18,2)) AS [生产进度%]
FROM bd_manu_order h
LEFT JOIN bl_manu_order l ON h.[合同号] = l.[合同号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ''MANU_ORDER''
                    AND s.doc_no = h.[合同号] AND s.canceled = ''Y'')
GROUP BY h.asp_cancel, l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位]');
PRINT N'[视图] v_manu_order_stats 已重建';
GO
-- ══ 自检(期望值写在「值」列)══
SELECT N'v_finish_in_detail.id / asp_cancel(期望都有)' AS 检查项,
       CAST(CASE WHEN COL_LENGTH('dbo.v_finish_in_detail','id') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10))
       + N' / ' +
       CAST(CASE WHEN COL_LENGTH('dbo.v_finish_in_detail','asp_cancel') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10)) AS 值
UNION ALL SELECT N'v_finish_in_stats.id / asp_cancel(期望都有)',
       CAST(CASE WHEN COL_LENGTH('dbo.v_finish_in_stats','id') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10))
       + N' / ' +
       CAST(CASE WHEN COL_LENGTH('dbo.v_finish_in_stats','asp_cancel') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10))
UNION ALL SELECT N'v_manu_order_stats.id / asp_cancel(期望都有)',
       CAST(CASE WHEN COL_LENGTH('dbo.v_manu_order_stats','id') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10))
       + N' / ' +
       CAST(CASE WHEN COL_LENGTH('dbo.v_manu_order_stats','asp_cancel') IS NOT NULL THEN 1 ELSE 0 END AS nvarchar(10))
UNION ALL SELECT N'仍缺 id/asp_cancel 的 flat 面板视图(期望 0)', CAST(COUNT(*) AS nvarchar(10))
       FROM yj_panel p WHERE p.mode = 'flat' AND OBJECT_ID(p.line_table) IS NOT NULL
         AND (COL_LENGTH(p.line_table,'id') IS NULL OR COL_LENGTH(p.line_table,'asp_cancel') IS NULL)
UNION ALL SELECT N'面板可见行数 v_finish_in_detail', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.v_finish_in_detail WHERE ISNULL(asp_cancel,'N') <> 'Y'
UNION ALL SELECT N'面板可见行数 v_finish_in_stats', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.v_finish_in_stats WHERE ISNULL(asp_cancel,'N') <> 'Y'
UNION ALL SELECT N'面板可见行数 v_manu_order_stats', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.v_manu_order_stats WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
