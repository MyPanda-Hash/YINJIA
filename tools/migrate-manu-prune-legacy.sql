-- migrate-manu-prune-legacy.sql — 生产加工单 A 类死字段下线(2026-09-23 用户拍板)
-- 依据:plang 55 列底稿映射核对+代码/面板引用扫描+数据层非空统计(审计结论 A 类)——
--   旧「生产工单 GD/WO_ORDER」模板整套复制残留,plang 无对应列,生单/排产/报工/入库/结案/看板全流程
--   无写入无读取,唯一引用=拆单复制白名单(被动)与 i18n 词典(标签≠使用)。
-- 2026-09-23 追加拍板:锭号 下线(建表自定义冗余编号,全系统仅 MANU_ORDER 独有,plang/SO/WO_ORDER 均无此字段,业务零读写;单据编号真源=合同号 MO 前缀自动编码)。保留:测试程序/机构/负责人/是否手工修改单据编码;
--   开工日期/附件1~6/拆分序号/源工单号(plang 映射内暂未启用);图号/需求令号/单重/总重等(§2 保留清单)。
-- 2026-09-23 再追加拍板:生产车间 下线(车间=生产线档案属性,不在加工单上选择,排产指派产线即定车间)。
--   连带:v_manu_schedule 重建(去车间列,产能/小时改挂 bs_prod_line.小时产能,待产判定仅看生产线)/v_line_load 重建(base 去车间引用,车间列恒取档案)。
-- 顺序:①先 DROP v_manu_order_detail(引用被删列) ②删列(每条独立 GO 批次:单条失败不连坐——
--   sqlcmd 同批次遇编译级错误会中止本批次剩余语句,首跑实证) ③注销 yj_field ④重建视图 ⑤孤儿词条清理
--   (NOT EXISTS 守卫:标签仍被其它面板引用则保留,如「现存量说明」被 9 个库存面板共用)。
-- 幂等:IF COL_LENGTH / IF EXISTS,可重复执行。
SET NOCOUNT ON;

-- ① 引用视图先拆(列删除后旧定义失效;v_manu_schedule/v_line_load 引用生产车间)
IF OBJECT_ID('v_manu_order_detail','V') IS NOT NULL DROP VIEW v_manu_order_detail;
GO
IF OBJECT_ID('v_line_load','V') IS NOT NULL DROP VIEW v_line_load;
GO
IF OBJECT_ID('v_manu_schedule','V') IS NOT NULL DROP VIEW v_manu_schedule;
GO

-- ② 删列:头表 13(状态五件套=旧状态机残留,真源 yj_doc_status;外部单据号/启用领料申请/对方仓库等=GD 模板残留)
IF COL_LENGTH('bd_manu_order', N'测试程序2') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [测试程序2];
GO
IF COL_LENGTH('bd_manu_order', N'生产订单客户') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [生产订单客户];
GO
IF COL_LENGTH('bd_manu_order', N'外部单据号') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [外部单据号];
GO
IF COL_LENGTH('bd_manu_order', N'启用领料申请') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [启用领料申请];
GO
IF COL_LENGTH('bd_manu_order', N'对方仓库') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [对方仓库];
GO
IF COL_LENGTH('bd_manu_order', N'启用派工') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [启用派工];
GO
IF COL_LENGTH('bd_manu_order', N'自动转移') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [自动转移];
GO
IF COL_LENGTH('bd_manu_order', N'产品自动添加到材料') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [产品自动添加到材料];
GO
-- 单据状态带默认约束(DF__...单据状态):先删约束再删列
-- (2026-09-24 重放守卫:约束名的哈希后缀**每个库各不相同**,写死名字跨库必炸——按实际名动态删)
IF EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c
           ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID('bd_manu_order') AND c.name = N'单据状态')
  DECLARE @dc sysname = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c
           ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID('bd_manu_order') AND c.name = N'单据状态');
IF @dc IS NOT NULL EXEC(N'ALTER TABLE bd_manu_order DROP CONSTRAINT ' + @dc + N';');
GO
IF COL_LENGTH('bd_manu_order', N'单据状态') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [单据状态];
GO
IF COL_LENGTH('bd_manu_order', N'审核人') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [审核人];
GO
IF COL_LENGTH('bd_manu_order', N'审核时间') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [审核时间];
GO
IF COL_LENGTH('bd_manu_order', N'审批人') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [审批人];
GO
IF COL_LENGTH('bd_manu_order', N'审批时间') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [审批时间];
GO

-- ② 删列:行表 6(GD 工单 BOM/说明/自定义项残留;可用量/现存量本体保留——齐套判断在用)
IF COL_LENGTH('bl_manu_order', N'生产类型') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [生产类型];
GO
IF COL_LENGTH('bl_manu_order', N'适用BOM') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [适用BOM];
GO
IF COL_LENGTH('bl_manu_order', N'BOM展开方式') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [BOM展开方式];
GO
IF COL_LENGTH('bl_manu_order', N'可用量说明') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [可用量说明];
GO
IF COL_LENGTH('bl_manu_order', N'现存量说明') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [现存量说明];
GO
IF COL_LENGTH('bl_manu_order', N'产品字符公用自定义项1') IS NOT NULL ALTER TABLE bl_manu_order DROP COLUMN [产品字符公用自定义项1];
GO

-- ② 追加:锭号(建表冗余编号;演示种子 3 张有值,生单链恒写空串;无默认约束)
IF COL_LENGTH('bd_manu_order', N'锭号') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [锭号];
GO
-- ② 追加:生产车间(车间=产线档案属性 bs_prod_line.生产车间;领料带入改由 WoPickingHandler 查档案)
IF COL_LENGTH('bd_manu_order', N'生产车间') IS NOT NULL ALTER TABLE bd_manu_order DROP COLUMN [生产车间];
GO
-- ③ 面板字段注销(MANU_ORDER 表单/列表 + MANU_ORDER_DETAIL 明细报表 + MANU_SCHEDULE 看板)
DELETE FROM yj_field WHERE panel_code IN (N'MANU_ORDER', N'MANU_ORDER_DETAIL', N'MANU_SCHEDULE') AND col_name IN (
  N'锭号', N'生产车间', N'测试程序2', N'生产订单客户', N'外部单据号', N'启用领料申请', N'对方仓库', N'启用派工', N'自动转移',
  N'产品自动添加到材料', N'单据状态', N'审核人', N'审核时间', N'审批人', N'审批时间', 
  N'生产类型', N'适用BOM', N'BOM展开方式', N'可用量说明', N'现存量说明', N'产品字符公用自定义项1');
GO

-- ④ 视图重建(头表 h.* 自动瘦身;行表显式列去 6 个已删列)
IF OBJECT_ID('v_manu_order_detail','V') IS NULL EXEC('CREATE VIEW v_manu_order_detail AS SELECT h.[合同号] AS [单据编号], h.*, l.[产品编码], l.[存货图片], l.[产品名称], l.[规格型号], l.[型号], l.[生产单位], l.[数量], l.[齐套数量(主)], l.[累计汇报套数(工序单位)], l.[可用量], l.[现存量], l.[图号], l.[单重], l.[总重], l.[需求令号] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]');
GO

-- ④ 追加重建:v_manu_schedule(2026-09-23 生产车间下线版:去车间列;产能/小时改挂 bs_prod_line.小时产能;
--    待产判定仅看生产线;其余列=五工序/箱数/交期三桶/状态机,与既有迭代口径一致)
CREATE VIEW v_manu_schedule AS
SELECT x.*,
       CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
            WHEN x.[成型完成] > 0 THEN x.[成型完成]
            WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
            WHEN x.[组装完成] > 0 THEN x.[组装完成]
            ELSE x.[装箱完成] END AS 开产量,
       CASE WHEN ISNULL(x.[排产数量],0) > 0 AND ISNULL(x.[入库数量],0) >= ISNULL(x.[排产数量],0) THEN N'完工'
            WHEN (CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
                       WHEN x.[成型完成] > 0 THEN x.[成型完成]
                       WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
                       WHEN x.[组装完成] > 0 THEN x.[组装完成]
                       ELSE x.[装箱完成] END) > 0 THEN N'在产'
            WHEN ISNULL(x.[生产线],N'') <> N'' THEN N'待产'
            ELSE N'未排产' END AS 生产状态
FROM (
SELECT l.id AS id, h.[合同号] AS 加工单号, h.[单据日期] AS 单据日期, h.[销售订单号] AS 销售订单号,
       h.[客户] AS 客户, ISNULL(pt.[客户价格等级], N'') AS 客户等级,
       h.[生产线] AS 生产线,
       ISNULL(h.[重点管控], N'否') AS 重点管控,
       ISNULL(pl.[小时产能], 0) AS [产能/小时],
       l.[产品编码] AS 产品编码, l.[产品名称] AS 产品名称,
       ISNULL(NULLIF(l.[规格型号], N''), iv.[规格型号]) AS 规格型号, l.[生产单位] AS 生产单位,
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
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'混料' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 混料完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'混料' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 混料未完成,
       ISNULL(l.[排产数量], 0) AS 成型计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'成型' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 成型完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'成型' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 成型未完成,
       ISNULL(l.[排产数量], 0) AS 切炭计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'切炭' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 切炭完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'切炭' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 切炭未完成,
       ISNULL(l.[排产数量], 0) AS 组装计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'组装' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 组装完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'组装' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 组装未完成,
       ISNULL(l.[排产数量], 0) AS 装箱计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 装箱完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 装箱未完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 未完成数量,
       CASE WHEN ISNULL(st.canceled,'Y') = 'Y' THEN N'已作废'
            WHEN ISNULL(st.stopped,'N') = 'Y' THEN N'已中止'
            WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,
       ISNULL(h.[源工单号], N'') AS 源工单号,
       CAST(NULL AS char(1)) AS asp_cancel
FROM dbo.bd_manu_order h
JOIN dbo.bl_manu_order l ON l.[合同号] = h.[合同号] AND ISNULL(l.asp_cancel,'N') <> 'Y'
LEFT JOIN dbo.yj_doc_status st ON st.panel_code = 'MANU_ORDER' AND st.doc_no = h.[合同号]
LEFT JOIN dbo.bs_partner pt ON pt.[往来单位编码] = h.[客户编码] OR (ISNULL(h.[客户编码],N'') = N'' AND pt.[往来单位名称] = h.[客户])
LEFT JOIN dbo.bs_prod_line pl ON pl.[生产线] = h.[生产线] AND ISNULL(pl.asp_cancel,'N') <> 'Y'
LEFT JOIN dbo.bs_inv iv ON iv.[存货编码] = l.[产品编码]
LEFT JOIN dbo.bl_so_order so ON so.[单据编号] = h.[销售订单号] AND so.[存货编码] = l.[产品编码]
WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
) x;
GO

-- ④ 追加重建:v_line_load(2026-09-23 版:base 去车间引用——车间不再来自工单;车间/日产能=产线档案,停用过滤同前)
CREATE VIEW v_line_load AS
WITH base AS (
    SELECT ISNULL(生产线,N'') AS 生产线, ISNULL(排产数量,0) AS q,
           CASE WHEN 工序交期 IS NULL THEN 计划开工日 ELSE 工序交期 END AS e,
           CASE WHEN 计划开工日 IS NULL THEN 工序交期 ELSE 计划开工日 END AS s
    FROM v_manu_schedule
    WHERE ISNULL(生产线,N'') <> N'' AND ISNULL(排产数量,0) > 0
      AND ISNULL(结案,N'N') <> N'Y' AND ISNULL(单据状态,N'') <> N'已作废'
),
clamped AS (
    SELECT 生产线, q,
           CASE WHEN s IS NULL THEN NULL
                WHEN e < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date)
                WHEN e > DATEADD(day, 13, CAST(GETDATE() AS date)) THEN DATEADD(day, 13, CAST(GETDATE() AS date))
                ELSE e END AS e2,
           CASE WHEN s IS NULL THEN NULL
                WHEN s < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date) ELSE s END AS s2
    FROM base
),
perday AS (
    SELECT d.生产线, dd.di AS idx, SUM(d.q * 1.0 / (DATEDIFF(day, d.s2, d.e2) + 1)) AS v
    FROM clamped d
    CROSS APPLY (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13)) dd(di)
    WHERE d.s2 IS NOT NULL AND dd.di <= DATEDIFF(day, d.s2, d.e2)
    GROUP BY d.生产线, dd.di
),
k AS (
    SELECT 生产线, 生产车间, 日产能, CAST(NULL AS int) AS idx, CAST(NULL AS decimal(18,4)) AS v
    FROM (SELECT 生产线, 生产车间, ISNULL(日产能,0) AS 日产能 FROM bs_prod_line
          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,0) = 0) c
    UNION ALL
    -- 负荷行仅保留启用档案线(2026-09-23 修复):停用线不进下拉/负荷面板;档案外脏值线一并排除
    SELECT p.生产线, p.生产车间, NULL, pd.idx, pd.v
    FROM perday pd JOIN bs_prod_line p ON p.生产线 = pd.生产线
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.停用,0) = 0
)
SELECT 生产线,
       MAX(生产车间) AS 生产车间,
       MAX(日产能) AS 日产能,
       CAST(ISNULL(MAX(CASE WHEN idx = 0 THEN v END), 0) AS decimal(18,2)) AS [今日负荷],
       CAST(ISNULL(MAX(CASE WHEN idx = 1  THEN v END), 0) AS decimal(18,2)) AS [D1],
       CAST(ISNULL(MAX(CASE WHEN idx = 2  THEN v END), 0) AS decimal(18,2)) AS [D2],
       CAST(ISNULL(MAX(CASE WHEN idx = 3  THEN v END), 0) AS decimal(18,2)) AS [D3],
       CAST(ISNULL(MAX(CASE WHEN idx = 4  THEN v END), 0) AS decimal(18,2)) AS [D4],
       CAST(ISNULL(MAX(CASE WHEN idx = 5  THEN v END), 0) AS decimal(18,2)) AS [D5],
       CAST(ISNULL(MAX(CASE WHEN idx = 6  THEN v END), 0) AS decimal(18,2)) AS [D6],
       CAST(ISNULL(MAX(CASE WHEN idx = 7  THEN v END), 0) AS decimal(18,2)) AS [D7],
       CAST(ISNULL(MAX(CASE WHEN idx = 8  THEN v END), 0) AS decimal(18,2)) AS [D8],
       CAST(ISNULL(MAX(CASE WHEN idx = 9  THEN v END), 0) AS decimal(18,2)) AS [D9],
       CAST(ISNULL(MAX(CASE WHEN idx = 10 THEN v END), 0) AS decimal(18,2)) AS [D10],
       CAST(ISNULL(MAX(CASE WHEN idx = 11 THEN v END), 0) AS decimal(18,2)) AS [D11],
       CAST(ISNULL(MAX(CASE WHEN idx = 12 THEN v END), 0) AS decimal(18,2)) AS [D12],
       CAST(ISNULL(MAX(CASE WHEN idx = 13 THEN v END), 0) AS decimal(18,2)) AS [D13],
       CAST(ISNULL(SUM(v), 0) AS decimal(18,2)) AS [合计负荷],
       CAST(ROW_NUMBER() OVER (ORDER BY 生产线) AS int) AS id,
       CAST(NULL AS char(1)) AS asp_cancel
FROM k GROUP BY 生产线;
GO

-- ⑤ 孤儿词条清理:标签不再被任何面板字段引用才删(「现存量说明」仍被库存面板引用→自动保留)
DELETE FROM yj_translation WHERE scope = N'field' AND ref_key IN (
  N'锭号', N'测试程序2', N'生产订单客户', N'启用领料申请', N'对方仓库', N'启用派工', N'自动转移', N'产品自动添加到材料',
  N'生产类型', N'适用BOM', N'BOM展开方式', N'可用量说明', N'产品字符公用自定义项1')
  AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = yj_translation.ref_key);
GO

-- 验证输出
SELECT N'bd 列数' AS 检查, COUNT(*) AS v FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order')
UNION ALL SELECT N'bl 列数', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bl_manu_order')
UNION ALL SELECT N'MANU_ORDER 字段', COUNT(*) FROM yj_field WHERE panel_code=N'MANU_ORDER'
UNION ALL SELECT N'MANU_ORDER_DETAIL 字段', COUNT(*) FROM yj_field WHERE panel_code=N'MANU_ORDER_DETAIL';
PRINT N'migrate-manu-prune-legacy 完成';
GO
