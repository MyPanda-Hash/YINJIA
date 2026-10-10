-- migrate-align-ledger-fields-20261008.sql
-- ⚠ 2026-10-10 修(服务器部署实测「四单偏离基线」):本脚本原含 **234 条针对四单的 yj_field 覆写**
--   (207 条纯 seq + 27 条 seq/hidden/visible),内嵌的是 **2026-10-08 当时正式库的取值**;而四单基线在
--   2026-10-09 因「采购入库明细启用仓位」**刷新过一次**(冻结副本 + 回正脚本 + fourdoc-baseline.tsv 同批更新)。
--   本脚本排在回正脚本之后执行,于是每次运行都把四单元数据**改回 10-08 老口径** ⇒ 四单回归闸
--   FourDocAudit 报「名次不符 182 处 / 内容变 4 处」(纯顺序与可见性,数据无损);脚本自称
--   「在正式库上执行等于 no-op」并不成立 —— 那些 UPDATE 没有取值守卫,是无条件覆写。
--   处置:**整段移除四单的元数据覆写** —— 四单字段/显示名/顺序/可见性一律以基线为准(唯一权威 =
--   docs/development/采购链四单字段与显示字段.md 与其快照 fourdoc-baseline.tsv,由回正脚本负责写入),
--   本脚本不再插手。两账套早已对齐(除本次引入的偏离外),故这部分职责已完结;
--   本脚本余下职责不变:列宽对齐(bs_line_capacity 备用1-20 / bl_sale_out.仓库)、
--   视图 v_manu_schedule 缺则建(EXEC 动态建,不引用库名)、清掉测试库多出的 10 行 yj_field。

-- ⚠ 2026-10-10 修(服务器部署实测「四单偏离基线 182 处」):本脚本内嵌的是 **2026-10-08 当时正式库(four doc)的 seq 取值**,
--   而四单基线在 2026-10-09 因「采购入库明细启用仓位」**刷新过一次**(冻结副本 + 回正脚本 + fourdoc-baseline.tsv 同批更新)。
--   本脚本在链尾执行,于是每次运行都把四单顺序**改回 10-08 老口径**,压过回正脚本写下的基线顺序 ⇒
--   四单回归闸 FourDocAudit 报「名次不符」182 处(纯顺序,内容未变);且脚本自称「正式库上等于 no-op」并不成立 ——
--   原语句形如 UPDATE yj_field SET seq=数值, **没有取值守卫**,是无条件覆写。
--   处置:**摘掉四单的 seq 覆写**(纯 seq 的 207 条整条删除;其余 27 条只去掉 seq 部分,保留可见性对齐),
--   顺序一律以基线(fourdoc-baseline.tsv / 采购链四单字段与显示字段.md)为准 —— 见 AGENTS.md「采购链四单字段与显示字段基线」。
--   本脚本余下职责(列宽、视图缺则建、多出的 10 行清理)不变;两账套已同步验证四单闸 [PASS]。

-- 目的:把测试库(HSDZ_MES_TEST)的**字段元数据与结构**对齐正式库(HSDZ_MES)。依据:
--   docs/development/采购链四单字段与显示字段.md(四单字段与显示字段唯一基线)
--
-- 取证(2026-10-08,均为只读对比):
--   tools/DbSchemaDiff.java  HSDZ_MES vs HSDZ_MES_TEST  →  RESULT: DIFF-22
--     · 列:bs_line_capacity 缺 备用1-20(20 列);bl_sale_out.仓库 测试库是 nvarchar(500)、正式库 nvarchar(1000)
--     · 视图:测试库缺 v_manu_schedule
--     · yj_field:测试库多 10 行(QC_INSP_REQ 备用1/2/21、QC_INSP_REQ_SERIES 备用2-8,早期探针残留)
--   tools/archive/_YjFieldAlign.java(按值比,18 个属性列)ALL → RESULT: DIFF-244
--     · 多 10 行(同上)、改 234 行(四单 seq 顺序差异为主,其中 27 行同时带 hidden/visible 变化 ——
--       一律以正式库口径为准,例:PURCHASE_IN.基本单位名称 / QC_INSP.部门名称 正式库是 hidden=1、visible=0)
--
-- 幂等与安全:
--   · 全部语句带存在性/取值守卫,**在正式库上执行等于 no-op**(列已存在、视图已存在、行不匹配即 0 行);
--   · 只改测试库:删的是测试库多出来的行,改的是与正式库取值不同的行;
--   · 视图定义按正式库定义逐字节内联(EXEC(N'...')),不引用任何库名,可直接随部署包发到服务器;
--   · 不删表、不改类型宽度以外的东西,不动业务数据。
--
-- 执行(两个账套都跑,顺序:正式 → 测试):
--   tools/ 下: YINJIA_SQL_DB=HSDZ_MES      java -cp lib\mssql-jdbc.jar DbSync.java run migrate-align-ledger-fields-20261008.sql
--              YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar DbSync.java run migrate-align-ledger-fields-20261008.sql
-- 校验:DbSchemaDiff → RESULT: IDENTICAL;_YjFieldAlign(ALL)→ RESULT: IDENTICAL

SET NOCOUNT ON;
GO

-- ═══ 一、物理结构对齐 ═══

-- 1.1 产线产能表补 备用1-20(动态字段备用列池;正式库已有,测试库缺)
-- ⚠ 2026-10-09 修正:原写法只判「列是否存在」,而**表不存在时 `COL_LENGTH` 返回 NULL**,
--   `NULL IS NULL` 为真 ⇒ 会去 ALTER 一张不存在的表,报「找不到对象 dbo.bs_line_capacity」
--   并让整条迁移链中止(DbSync「失败 1」,后续脚本全不执行)。
--   本机两个账套都没有这张表,且它既不在 tools/db-inuse-tables.txt、也不在《数据库表清单》里,
--   后端代码零引用 ⇒ 先判表在不在:表不在就跳过(「对齐」本就无从对齐一张没有的表)。
IF OBJECT_ID(N'dbo.bs_line_capacity') IS NULL
  PRINT N'[skip] dbo.bs_line_capacity 不存在(未在册),跳过 备用1-20 补列';
ELSE
BEGIN
IF COL_LENGTH('dbo.bs_line_capacity', N'备用1') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用1] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用2') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用2] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用3') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用3] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用4') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用4] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用5') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用5] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用6') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用6] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用7') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用7] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用8') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用8] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用9') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用9] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用10') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用10] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用11') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用11] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用12') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用12] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用13') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用13] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用14') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用14] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用15') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用15] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用16') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用16] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用17') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用17] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用18') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用18] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用19') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用19] nvarchar(500) NULL;
IF COL_LENGTH('dbo.bs_line_capacity', N'备用20') IS NULL ALTER TABLE dbo.bs_line_capacity ADD [备用20] nvarchar(500) NULL;
END
GO

-- 1.2 销售出库单.仓库 宽度对齐(nvarchar(500) → nvarchar(1000),与正式库一致)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_sale_out') AND name = N'仓库' AND max_length < 2000)
  ALTER TABLE dbo.bl_sale_out ALTER COLUMN [仓库] nvarchar(1000) NULL;
GO

-- 1.3 视图 v_manu_schedule(正式库有、测试库缺;定义取自正式库 sys.sql_modules,逐字节内联)
IF OBJECT_ID('dbo.v_manu_schedule') IS NULL
  EXEC(N'CREATE VIEW v_manu_schedule AS
SELECT x.*,
       CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
            WHEN x.[成型完成] > 0 THEN x.[成型完成]
            WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
            WHEN x.[组装完成] > 0 THEN x.[组装完成]
            ELSE x.[装箱完成] END AS 开产量,
       (SELECT MAX(v) FROM (VALUES (x.[混料完成]), (x.[成型完成]), (x.[切炭完成]), (x.[组装完成]), (x.[装箱完成])) AS t(v)) AS 已报工,
       CASE WHEN ISNULL(x.[排产数量],0) > 0 AND ISNULL(x.[入库数量],0) >= ISNULL(x.[排产数量],0) THEN N''完工''
            WHEN (CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
                       WHEN x.[成型完成] > 0 THEN x.[成型完成]
                       WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
                       WHEN x.[组装完成] > 0 THEN x.[组装完成]
                       ELSE x.[装箱完成] END) > 0 THEN N''在产''
            WHEN ISNULL(x.[生产线],N'''') <> N'''' THEN N''待产''
            ELSE N''未排产'' END AS 生产状态
FROM (
SELECT l.id AS id, h.[合同号] AS 加工单号, h.[单据日期] AS 单据日期, h.[销售订单号] AS 销售订单号,
       h.[客户] AS 客户, ISNULL(pt.[客户价格等级], N'''') AS 客户等级,
       h.[生产线] AS 生产线,
       ISNULL(h.[重点管控], N''否'') AS 重点管控,
       ISNULL(pl.[小时产能], 0) AS [产能/小时],
       l.[产品编码] AS 产品编码, l.[产品名称] AS 产品名称,
       ISNULL(NULLIF(l.[规格型号], N''''), iv.[规格型号]) AS 规格型号, l.[生产单位] AS 生产单位,
       l.[批号] AS 批号,
       ISNULL(so.[数量], 0) AS 销售订单数量,
       ISNULL(l.[需求数量], ISNULL(l.[数量], 0)) AS 需求数量,
       ISNULL(l.[数量], ISNULL(l.[排产数量], 0)) AS 生产订单数量,
       ISNULL(l.[排产数量], 0) AS 排产数量,
       ISNULL(l.[排产数量], 0) AS 生产计划数量,
       ISNULL(l.[每箱数量], 0) AS 每箱数量,
       CASE WHEN ISNULL(l.[每箱数量], 0) > 0
            THEN CAST(ISNULL(l.[排产数量], 0) / l.[每箱数量] AS decimal(18,2)) ELSE 0 END AS 箱数,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 入库数量,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 实际完成数量,
       ISNULL(l.[排产数量], 0) - COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 余量,
       CAST(h.[预开工日] AS date) AS 计划开工日,
       CAST(h.[预完工日] AS date) AS 交期,
       CAST(h.[预完工日] AS date) AS 工序交期,
       CASE WHEN h.[预完工日] IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) END AS [交期紧迫度(天)],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) <= 7
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [7天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) BETWEEN 8 AND 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [15天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) > 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [大于15天],
       h.[结案] AS 结案,
       ISNULL(l.[排产数量], 0) AS 混料计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''混料'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 混料完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''混料'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 混料未完成,
       ISNULL(l.[排产数量], 0) AS 成型计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''成型'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 成型完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''成型'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 成型未完成,
       ISNULL(l.[排产数量], 0) AS 切炭计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''切炭'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 切炭完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''切炭'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 切炭未完成,
       ISNULL(l.[排产数量], 0) AS 组装计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''组装'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 组装完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''组装'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 组装未完成,
       ISNULL(l.[排产数量], 0) AS 装箱计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''装箱'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 装箱完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''装箱'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 装箱未完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N''装箱'' AND ISNULL(p.asp_cancel,''N'') <> ''Y''), 0) AS 未完成数量,
       CASE WHEN ISNULL(st.canceled,''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped,''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 单据状态,
       ISNULL(h.[源工单号], N'''') AS 源工单号,
       CAST(NULL AS char(1)) AS asp_cancel
FROM dbo.bd_manu_order h
JOIN dbo.bl_manu_order l ON l.[合同号] = h.[合同号] AND ISNULL(l.asp_cancel,''N'') <> ''Y''
LEFT JOIN dbo.yj_doc_status st ON st.panel_code = ''MANU_ORDER'' AND st.doc_no = h.[合同号]
LEFT JOIN dbo.bs_partner pt ON pt.[往来单位编码] = h.[客户编码] OR (ISNULL(h.[客户编码],N'''') = N'''' AND pt.[往来单位名称] = h.[客户])
LEFT JOIN dbo.bs_prod_line pl ON pl.[生产线] = h.[生产线] AND ISNULL(pl.asp_cancel,''N'') <> ''Y''
LEFT JOIN dbo.bs_inv iv ON iv.[存货编码] = l.[产品编码]
LEFT JOIN dbo.bl_so_order so ON so.[单据编号] = h.[销售订单号] AND so.[存货编码] = l.[产品编码]
WHERE ISNULL(h.asp_cancel,''N'') <> ''Y''
) x;');
GO

-- ═══ 二、yj_field 元数据对齐(按值:显示名/顺序/位置/参照源/可见性…) ═══
-- 2.1 删除测试库多出来的 10 行(早期探针残留,正式库没有)
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ' AND col_name=N'备用1';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ' AND col_name=N'备用2';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ' AND col_name=N'备用21';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用2';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用3';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用4';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用5';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用6';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用7';
DELETE FROM yj_field WHERE panel_code=N'QC_INSP_REQ_SERIES' AND col_name=N'备用8';
GO
