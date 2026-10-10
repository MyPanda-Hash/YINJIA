-- migrate-align-ledger-fields-20261008.sql
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
UPDATE yj_field SET seq=300 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'ERP单号';
UPDATE yj_field SET seq=230 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'交货方式';
UPDATE yj_field SET seq=240 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'交货方式编码';
UPDATE yj_field SET seq=670 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓位';
UPDATE yj_field SET seq=270 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓位id';
UPDATE yj_field SET seq=280 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓位名称';
UPDATE yj_field SET seq=680 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓位编码';
UPDATE yj_field SET seq=190 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓库';
UPDATE yj_field SET seq=250 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓库id';
UPDATE yj_field SET seq=840 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓库名称_sp_name';
UPDATE yj_field SET seq=260 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓库启用仓位管理';
UPDATE yj_field SET seq=660 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'仓库编码';
UPDATE yj_field SET seq=820 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'付款方式编码';
UPDATE yj_field SET seq=500 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'付款账户';
UPDATE yj_field SET seq=840 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'付款账户编码';
UPDATE yj_field SET seq=790 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'价税合计本位币';
UPDATE yj_field SET seq=60 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'供应商';
UPDATE yj_field SET seq=50 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'供应商编码';
UPDATE yj_field SET seq=510 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'保险金额';
UPDATE yj_field SET seq=280 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'修改人';
UPDATE yj_field SET seq=750 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'修改人编码';
UPDATE yj_field SET seq=260 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'修改时间';
UPDATE yj_field SET seq=30 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'入库类别';
UPDATE yj_field SET seq=270 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'创建人';
UPDATE yj_field SET seq=730 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'创建人编码';
UPDATE yj_field SET seq=180 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'创建时间';
UPDATE yj_field SET seq=520 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'到期日';
UPDATE yj_field SET seq=70 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'匹配来源单号';
UPDATE yj_field SET seq=80 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'单价';
UPDATE yj_field SET seq=770 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'单位成本视图';
UPDATE yj_field SET seq=200 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'单据关闭状态';
UPDATE yj_field SET seq=700 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'单据状态_bill_status';
UPDATE yj_field SET seq=550 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货人';
UPDATE yj_field SET seq=640 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货区县名称';
UPDATE yj_field SET seq=650 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货区县编码';
UPDATE yj_field SET seq=580 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货国家名称';
UPDATE yj_field SET seq=590 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货国家编码';
UPDATE yj_field SET seq=570 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货地址';
UPDATE yj_field SET seq=620 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货市区名称';
UPDATE yj_field SET seq=630 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货市区编码';
UPDATE yj_field SET seq=560 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货电话';
UPDATE yj_field SET seq=600 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货省份名称';
UPDATE yj_field SET seq=610 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'发货省份编码';
UPDATE yj_field SET seq=110 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'含税单价';
UPDATE yj_field SET seq=120 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'含税金额';
UPDATE yj_field SET seq=180 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品id';
UPDATE yj_field SET seq=230 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品是否保质期';
UPDATE yj_field SET seq=200 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品是否多单位';
UPDATE yj_field SET seq=210 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品是否序列号';
UPDATE yj_field SET seq=240 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品是否批次';
UPDATE yj_field SET seq=220 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'商品是否辅助属性';
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'基本单位名称';
UPDATE yj_field SET seq=870 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'备注';
UPDATE yj_field SET seq=10 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'存货编码';
UPDATE yj_field SET seq=40 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'实收数量';
UPDATE yj_field SET seq=60 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'实收数量2';
UPDATE yj_field SET seq=760 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'审核人_auditor_name';
UPDATE yj_field SET seq=780 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'审核人编码';
UPDATE yj_field SET seq=710 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'审核时间_audit_time';
UPDATE yj_field SET seq=360 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'客户';
UPDATE yj_field SET seq=370 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'客户编码';
UPDATE yj_field SET seq=760 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'成本视图';
UPDATE yj_field SET seq=130, hidden=1, visible=0 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'批号';
UPDATE yj_field SET seq=690 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'批次键';
UPDATE yj_field SET seq=750 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'折扣率%';
UPDATE yj_field SET seq=850 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'换算率_conversion_rate';
UPDATE yj_field SET seq=330, hidden=1, visible=0 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'是否已转ERP';
UPDATE yj_field SET seq=140, hidden=0, visible=1 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'是否来料检验';
UPDATE yj_field SET seq=800 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'是否赠品';
UPDATE yj_field SET seq=800 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'未结算金额本位币';
UPDATE yj_field SET seq=860 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'本次结算金额本位币';
UPDATE yj_field SET seq=190 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'来源单号';
UPDATE yj_field SET seq=170 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'来源单据';
UPDATE yj_field SET seq=40 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'汇率';
UPDATE yj_field SET seq=290 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'源单行号';
UPDATE yj_field SET seq=150 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'特采';
UPDATE yj_field SET seq=170 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'现存量';
UPDATE yj_field SET seq=830 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'生产日期';
UPDATE yj_field SET seq=100 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'税率%';
UPDATE yj_field SET seq=80 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'经手人';
UPDATE yj_field SET seq=220 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'经手人编码';
UPDATE yj_field SET seq=540 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'结算期限';
UPDATE yj_field SET seq=530 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'结算期限编码';
UPDATE yj_field SET seq=250 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'结算状态';
UPDATE yj_field SET seq=450 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人区县名称';
UPDATE yj_field SET seq=460 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人区县编码';
UPDATE yj_field SET seq=390 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人国家名称';
UPDATE yj_field SET seq=400 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人国家编码';
UPDATE yj_field SET seq=430 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人市区名称';
UPDATE yj_field SET seq=440 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人市区编码';
UPDATE yj_field SET seq=380 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人电话';
UPDATE yj_field SET seq=410 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人省份名称';
UPDATE yj_field SET seq=420 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系人省份编码';
UPDATE yj_field SET seq=470 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'联系地址';
UPDATE yj_field SET seq=160 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'行号';
UPDATE yj_field SET seq=30 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'规格型号';
UPDATE yj_field SET seq=50 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'计量单位';
UPDATE yj_field SET seq=70 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'计量单位2';
UPDATE yj_field SET seq=310 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'转ERP操作人';
UPDATE yj_field SET seq=320 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'转ERP时间';
UPDATE yj_field SET seq=300 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'辅助属性id';
UPDATE yj_field SET seq=780 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'退货数量';
UPDATE yj_field SET seq=810 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'送检数量';
UPDATE yj_field SET seq=340 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'部门';
UPDATE yj_field SET seq=820 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'部门名称';
UPDATE yj_field SET seq=350 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'部门编码';
UPDATE yj_field SET seq=160, hidden=0, visible=1 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'采购订单号';
UPDATE yj_field SET seq=90 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'金额';
UPDATE yj_field SET seq=210 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'销售订单号';
UPDATE yj_field SET seq=90 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件1';
UPDATE yj_field SET seq=100 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件2';
UPDATE yj_field SET seq=110 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件3';
UPDATE yj_field SET seq=120 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件4';
UPDATE yj_field SET seq=130 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件5';
UPDATE yj_field SET seq=140 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'附件6';
UPDATE yj_field SET seq=490 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'预付金额';
UPDATE yj_field SET seq=150 WHERE panel_code=N'PURCHASE_IN' AND col_name=N'验货人';
UPDATE yj_field SET seq=100 WHERE panel_code=N'QC_INSP' AND col_name=N'不合格数量';
UPDATE yj_field SET seq=270, hidden=1, visible=0 WHERE panel_code=N'QC_INSP' AND col_name=N'仓库代码';
UPDATE yj_field SET seq=70 WHERE panel_code=N'QC_INSP' AND col_name=N'供应商';
UPDATE yj_field SET seq=80 WHERE panel_code=N'QC_INSP' AND col_name=N'供应商代码';
UPDATE yj_field SET seq=60 WHERE panel_code=N'QC_INSP' AND col_name=N'单价';
UPDATE yj_field SET seq=50, hidden=1, visible=0 WHERE panel_code=N'QC_INSP' AND col_name=N'单位';
UPDATE yj_field SET seq=240, hidden=1, visible=0 WHERE panel_code=N'QC_INSP' AND col_name=N'单据状态';
UPDATE yj_field SET seq=90 WHERE panel_code=N'QC_INSP' AND col_name=N'合格数量';
UPDATE yj_field SET seq=240, hidden=1, visible=0 WHERE panel_code=N'QC_INSP' AND col_name=N'备注';
UPDATE yj_field SET seq=260 WHERE panel_code=N'QC_INSP' AND col_name=N'审核人';
UPDATE yj_field SET seq=270 WHERE panel_code=N'QC_INSP' AND col_name=N'审核时间';
UPDATE yj_field SET seq=170 WHERE panel_code=N'QC_INSP' AND col_name=N'总结论';
UPDATE yj_field SET seq=150 WHERE panel_code=N'QC_INSP' AND col_name=N'执行标准';
UPDATE yj_field SET seq=150 WHERE panel_code=N'QC_INSP' AND col_name=N'批次号';
UPDATE yj_field SET seq=280 WHERE panel_code=N'QC_INSP' AND col_name=N'批次键';
UPDATE yj_field SET seq=110 WHERE panel_code=N'QC_INSP' AND col_name=N'报废数量';
UPDATE yj_field SET seq=120 WHERE panel_code=N'QC_INSP' AND col_name=N'损耗';
UPDATE yj_field SET seq=130 WHERE panel_code=N'QC_INSP' AND col_name=N'损耗率';
UPDATE yj_field SET seq=210 WHERE panel_code=N'QC_INSP' AND col_name=N'日期';
UPDATE yj_field SET seq=40 WHERE panel_code=N'QC_INSP' AND col_name=N'暂收单号';
UPDATE yj_field SET seq=110 WHERE panel_code=N'QC_INSP' AND col_name=N'检验员';
UPDATE yj_field SET seq=140 WHERE panel_code=N'QC_INSP' AND col_name=N'检验方案';
UPDATE yj_field SET seq=120 WHERE panel_code=N'QC_INSP' AND col_name=N'检验日期';
UPDATE yj_field SET seq=160 WHERE panel_code=N'QC_INSP' AND col_name=N'检验类型';
UPDATE yj_field SET seq=130 WHERE panel_code=N'QC_INSP' AND col_name=N'检验编号';
UPDATE yj_field SET seq=20 WHERE panel_code=N'QC_INSP' AND col_name=N'物料名称';
UPDATE yj_field SET seq=190 WHERE panel_code=N'QC_INSP' AND col_name=N'物料描述';
UPDATE yj_field SET seq=10 WHERE panel_code=N'QC_INSP' AND col_name=N'物料编码';
UPDATE yj_field SET seq=140 WHERE panel_code=N'QC_INSP' AND col_name=N'生产日期';
UPDATE yj_field SET seq=200 WHERE panel_code=N'QC_INSP' AND col_name=N'箱数';
UPDATE yj_field SET seq=220 WHERE panel_code=N'QC_INSP' AND col_name=N'结案';
UPDATE yj_field SET seq=30 WHERE panel_code=N'QC_INSP' AND col_name=N'规格型号';
UPDATE yj_field SET seq=70 WHERE panel_code=N'QC_INSP' AND col_name=N'计量单位';
UPDATE yj_field SET seq=90 WHERE panel_code=N'QC_INSP' AND col_name=N'部门';
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code=N'QC_INSP' AND col_name=N'部门名称';
UPDATE yj_field SET seq=100 WHERE panel_code=N'QC_INSP' AND col_name=N'部门编码';
UPDATE yj_field SET seq=50 WHERE panel_code=N'QC_INSP' AND col_name=N'采购订单号';
UPDATE yj_field SET seq=40 WHERE panel_code=N'QC_INSP' AND col_name=N'采购订单行号';
UPDATE yj_field SET seq=180 WHERE panel_code=N'QC_INSP' AND col_name=N'附件1';
UPDATE yj_field SET seq=190 WHERE panel_code=N'QC_INSP' AND col_name=N'附件2';
UPDATE yj_field SET seq=200 WHERE panel_code=N'QC_INSP' AND col_name=N'附件3';
UPDATE yj_field SET seq=210 WHERE panel_code=N'QC_INSP' AND col_name=N'附件4';
UPDATE yj_field SET seq=220 WHERE panel_code=N'QC_INSP' AND col_name=N'附件5';
UPDATE yj_field SET seq=230 WHERE panel_code=N'QC_INSP' AND col_name=N'附件6';
UPDATE yj_field SET seq=370, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'仓库';
UPDATE yj_field SET seq=210, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'供应商';
UPDATE yj_field SET seq=230, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'入库单号';
UPDATE yj_field SET seq=220, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'入库数量';
UPDATE yj_field SET seq=440 WHERE panel_code=N'QC_RECV' AND col_name=N'制单号';
UPDATE yj_field SET seq=410 WHERE panel_code=N'QC_RECV' AND col_name=N'剩余数量';
UPDATE yj_field SET seq=90 WHERE panel_code=N'QC_RECV' AND col_name=N'单价';
UPDATE yj_field SET seq=10 WHERE panel_code=N'QC_RECV' AND col_name=N'单据编号';
UPDATE yj_field SET seq=400 WHERE panel_code=N'QC_RECV' AND col_name=N'发货数量';
UPDATE yj_field SET seq=170 WHERE panel_code=N'QC_RECV' AND col_name=N'含税单价';
UPDATE yj_field SET seq=190 WHERE panel_code=N'QC_RECV' AND col_name=N'含税金额';
UPDATE yj_field SET seq=450 WHERE panel_code=N'QC_RECV' AND col_name=N'品质复核人';
UPDATE yj_field SET seq=460 WHERE panel_code=N'QC_RECV' AND col_name=N'品质复核时间';
UPDATE yj_field SET seq=350 WHERE panel_code=N'QC_RECV' AND col_name=N'备注';
UPDATE yj_field SET seq=220 WHERE panel_code=N'QC_RECV' AND col_name=N'审核人';
UPDATE yj_field SET seq=230 WHERE panel_code=N'QC_RECV' AND col_name=N'审核时间';
UPDATE yj_field SET seq=80, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'总金额';
UPDATE yj_field SET seq=70 WHERE panel_code=N'QC_RECV' AND col_name=N'批次号';
UPDATE yj_field SET seq=240 WHERE panel_code=N'QC_RECV' AND col_name=N'批次键';
UPDATE yj_field SET seq=200, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'折扣';
UPDATE yj_field SET seq=330 WHERE panel_code=N'QC_RECV' AND col_name=N'折扣%';
UPDATE yj_field SET seq=380 WHERE panel_code=N'QC_RECV' AND col_name=N'折扣金额';
UPDATE yj_field SET seq=430 WHERE panel_code=N'QC_RECV' AND col_name=N'报废数量';
UPDATE yj_field SET seq=100 WHERE panel_code=N'QC_RECV' AND col_name=N'数量';
UPDATE yj_field SET seq=120 WHERE panel_code=N'QC_RECV' AND col_name=N'数量2';
UPDATE yj_field SET seq=150 WHERE panel_code=N'QC_RECV' AND col_name=N'日期';
UPDATE yj_field SET seq=390 WHERE panel_code=N'QC_RECV' AND col_name=N'条码';
UPDATE yj_field SET seq=90 WHERE panel_code=N'QC_RECV' AND col_name=N'来料性质';
UPDATE yj_field SET seq=50 WHERE panel_code=N'QC_RECV' AND col_name=N'物料名称';
UPDATE yj_field SET seq=80 WHERE panel_code=N'QC_RECV' AND col_name=N'物料描述';
UPDATE yj_field SET seq=20 WHERE panel_code=N'QC_RECV' AND col_name=N'物料编码';
UPDATE yj_field SET seq=360, hidden=1 WHERE panel_code=N'QC_RECV' AND col_name=N'现存量';
UPDATE yj_field SET seq=260, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'税别代码';
UPDATE yj_field SET seq=270, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'税别说明';
UPDATE yj_field SET seq=160 WHERE panel_code=N'QC_RECV' AND col_name=N'税率%';
UPDATE yj_field SET seq=70, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'税额';
UPDATE yj_field SET seq=300, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'箱数';
UPDATE yj_field SET seq=250, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'结案';
UPDATE yj_field SET seq=60 WHERE panel_code=N'QC_RECV' AND col_name=N'规格型号';
UPDATE yj_field SET seq=110 WHERE panel_code=N'QC_RECV' AND col_name=N'计量单位';
UPDATE yj_field SET seq=130 WHERE panel_code=N'QC_RECV' AND col_name=N'计量单位2';
UPDATE yj_field SET seq=290, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'订单号';
UPDATE yj_field SET seq=420 WHERE panel_code=N'QC_RECV' AND col_name=N'退料数量';
UPDATE yj_field SET seq=310, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'部门';
UPDATE yj_field SET seq=320, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'部门名称';
UPDATE yj_field SET seq=30 WHERE panel_code=N'QC_RECV' AND col_name=N'采购单号';
UPDATE yj_field SET seq=210 WHERE panel_code=N'QC_RECV' AND col_name=N'采购订单号';
UPDATE yj_field SET seq=40 WHERE panel_code=N'QC_RECV' AND col_name=N'采购订单行号';
UPDATE yj_field SET seq=60, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'金额';
UPDATE yj_field SET seq=150 WHERE panel_code=N'QC_RECV' AND col_name=N'附件1';
UPDATE yj_field SET seq=160 WHERE panel_code=N'QC_RECV' AND col_name=N'附件2';
UPDATE yj_field SET seq=170 WHERE panel_code=N'QC_RECV' AND col_name=N'附件3';
UPDATE yj_field SET seq=180 WHERE panel_code=N'QC_RECV' AND col_name=N'附件4';
UPDATE yj_field SET seq=190 WHERE panel_code=N'QC_RECV' AND col_name=N'附件5';
UPDATE yj_field SET seq=200 WHERE panel_code=N'QC_RECV' AND col_name=N'附件6';
UPDATE yj_field SET seq=340 WHERE panel_code=N'QC_RECV' AND col_name=N'预计到货日期';
UPDATE yj_field SET seq=240, hidden=1, visible=0 WHERE panel_code=N'QC_RECV' AND col_name=N'领料单号';
UPDATE yj_field SET seq=80 WHERE panel_code=N'QC_RETURN' AND col_name=N'仓库';
UPDATE yj_field SET seq=60 WHERE panel_code=N'QC_RETURN' AND col_name=N'供应商';
UPDATE yj_field SET seq=110 WHERE panel_code=N'QC_RETURN' AND col_name=N'单据状态';
UPDATE yj_field SET seq=140 WHERE panel_code=N'QC_RETURN' AND col_name=N'备注';
UPDATE yj_field SET seq=120 WHERE panel_code=N'QC_RETURN' AND col_name=N'审核人';
UPDATE yj_field SET seq=130 WHERE panel_code=N'QC_RETURN' AND col_name=N'审核时间';
UPDATE yj_field SET seq=100 WHERE panel_code=N'QC_RETURN' AND col_name=N'经手人';
UPDATE yj_field SET seq=90 WHERE panel_code=N'QC_RETURN' AND col_name=N'退货原因';
UPDATE yj_field SET seq=70 WHERE panel_code=N'QC_RETURN' AND col_name=N'退货类型';
UPDATE yj_field SET seq=40 WHERE panel_code=N'QC_RETURN' AND col_name=N'采购订单号';
UPDATE yj_field SET seq=150 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件1';
UPDATE yj_field SET seq=160 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件2';
UPDATE yj_field SET seq=170 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件3';
UPDATE yj_field SET seq=180 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件4';
UPDATE yj_field SET seq=190 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件5';
UPDATE yj_field SET seq=200 WHERE panel_code=N'QC_RETURN' AND col_name=N'附件6';
GO
