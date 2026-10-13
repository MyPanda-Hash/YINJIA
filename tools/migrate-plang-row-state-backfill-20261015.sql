/* ============================================================
   migrate-plang-row-state-backfill-20261015.sql — 2026-10-15
   按「工单号 + 工单行号」**重算每一行**的工序状态(修正历史整单口径写下的脏缓存)

   背景(用户口径 2026-10-15):「工单号+工单行号确定当前唯一工单,各个工单的进程,流程追溯
   都这样实现,都需要这两个进行确定。」

   plang 的四列(当前工序 / 当前工序完工量 / 完工状态 / 完工时间)是**报工审核时写下的缓存**。
   2026-10-15 之前 ProcessTaskService.syncWorkOrderState 是**整单聚合**写的:
     · 计划量 = Σ整单 pl_sl、入库量 = Σ整单 rk_sl、路线取**整单首条**非空;
     · 报工量按 gldh 整单汇总;
     · UPDATE ... WHERE pl_no=? ⇒ **该工单每一行都被刷成同一个值**。
   实测 GD-2026-10-0002:只有行7 有报工(成型 56000),但 8 行全部被写成「在制/切炭」;
   行2/3/4 的路线是 GY-2026-10-0003,却按行1 的 GY-CB-STD 算的状态。
   ⇒ 界面「当前工序/工序进度/生产状态」在同工单不同行之间**全是串的**。

   代码已修(ProcessTaskService.syncWorkOrderState 改为逐行各算各的);本脚本把**存量脏缓存**
   按同一口径重算一遍(与代码逻辑一一对应,幂等:重跑结果一致)。

   重算口径(逐行):
     · 路线 = **本行** plang.[工艺路线](空则标准五步 混料/成型/切炭/组装/装箱);
     · 各工序完工量 = 该行已审报工量,锚 scjl.gd_id → plang_pc.plang_id = 本行,
       老数据 gd_id 为空时按(工单号 + 本行批次号)兜底;
     · 当前工序 = 路线上第一道未做满 本行 pl_sl 的工序(全做满停在末道);
     · 完工状态 = 全部工序达标 或 本行入库 ≥ 本行排产 → 生产完工;有报工 → 在制;否则 未开工;
     · 完工时间 = 生产完工时保留原值/取当天,否则清空;ja = 生产完工 → 'Y',
       从生产完工退回且原本已结案 → 'N',其余保持。

   ⚠ 不碰任何单据/报工/库存数据,只重算这四列派生缓存。
   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.plang', N'U') IS NULL
BEGIN
    PRINT N'[跳过] 无 plang 表';
    RETURN;
END
GO
-- 逐行重算:用 CROSS APPLY 取本行路线工序,OUTER APPLY 取本行各工序完工量
;WITH rowrep AS (   -- 本行 × 工序 → 已审报工量
    SELECT p.id AS 行id, ISNULL(s.gxdm, N'') AS 工序, SUM(ISNULL(s.sl,0)) AS 完工量
    FROM dbo.plang p
    JOIN dbo.plang_pc pc ON pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
    JOIN dbo.scjl s ON s.gd_id = pc.id AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y'
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
    GROUP BY p.id, s.gxdm
    UNION ALL
    -- 老数据:gd_id 为空 ⇒ 按(工单号 + 本行批次号)兜底
    SELECT p.id AS 行id, ISNULL(s.gxdm, N'') AS 工序, SUM(ISNULL(s.sl,0)) AS 完工量
    FROM dbo.plang p
    JOIN dbo.scjl s ON s.gldh = p.pl_no AND ISNULL(s.gd_id,0) = 0
         AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y'
         AND ISNULL(s.[批次号],N'') = ISNULL(p.[批次号],N'') AND ISNULL(p.[批次号],N'') <> N''
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
    GROUP BY p.id, s.gxdm
),
agg AS (            -- 本行 × 工序 合计(两来源相加)
    SELECT 行id, 工序, SUM(完工量) AS 完工量 FROM rowrep WHERE 工序 <> N'' GROUP BY 行id, 工序
),
ops AS (            -- 本行路线工序(有序);无路线 → 标准五步
    SELECT p.id AS 行id, r.工序名称, ISNULL(r.加工顺序, 999) AS 序
    FROM dbo.plang p
    JOIN dbo.bs_route r ON r.工艺路线编码 = ISNULL(p.[工艺路线],N'')
         AND ISNULL(r.asp_cancel,'N') <> 'Y' AND ISNULL(r.工序名称,N'') <> N''
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
    UNION ALL
    SELECT p.id, v.工序, v.序
    FROM dbo.plang p
    CROSS JOIN (VALUES (N'混料',1),(N'成型',2),(N'切炭',3),(N'组装',4),(N'装箱',5)) v(工序, 序)
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
      AND NOT EXISTS (SELECT 1 FROM dbo.bs_route r WHERE r.工艺路线编码 = ISNULL(p.[工艺路线],N'')
                      AND ISNULL(r.asp_cancel,'N') <> 'Y' AND ISNULL(r.工序名称,N'') <> N'')
),
step AS (           -- 每行:首道未达标工序 + 是否全部达标 + 是否有任何报工
    SELECT o.行id,
           MIN(CASE WHEN ISNULL(a.完工量,0) < ISNULL(p.pl_sl,0) - 0.0001 THEN o.序 END) AS 未达标序,
           -- ⚠ 全达标 = **没有任何一道**未达标 ⇒ MAX(缺料标记)=0。
           --   写成 MIN(...)=0 是错的:只要有一道达标(MIN 取到 0)就误判全达标
           --   (2026-10-15 实测:行7 成型 56000 达标、切炭 0 未达标,却被判成"全达标"⇒ 误置生产完工/ja=Y)
           CASE WHEN MAX(CASE WHEN ISNULL(a.完工量,0) < ISNULL(p.pl_sl,0) - 0.0001 THEN 1 ELSE 0 END) = 0
                     AND ISNULL(p.pl_sl,0) > 0 THEN 1 ELSE 0 END AS 全达标,
           CASE WHEN MAX(ISNULL(a.完工量,0)) > 0 THEN 1 ELSE 0 END AS 有报工,
           MAX(o.序) AS 末道序
    FROM ops o
    JOIN dbo.plang p ON p.id = o.行id
    LEFT JOIN agg a ON a.行id = o.行id AND a.工序 = o.工序名称
    GROUP BY o.行id, p.pl_sl
),
calc AS (
    SELECT p.id AS 行id,
           ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库,
           ISNULL(p.[完工状态],N'') AS 原状态, ISNULL(p.ja,N'N') AS 原结案,
           s.未达标序, s.末道序, s.全达标, s.有报工,
           -- 当前工序:未达标那道;全达标则末道
           (SELECT TOP 1 o2.工序名称 FROM ops o2
             WHERE o2.行id = p.id
               AND o2.序 = CASE WHEN s.未达标序 IS NULL THEN s.末道序 ELSE s.未达标序 END) AS 当前工序
    FROM dbo.plang p
    JOIN step s ON s.行id = p.id
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
)
UPDATE p SET
    p.[当前工序] = ISNULL(c.当前工序, p.[当前工序]),
    p.[当前工序完工量] = ISNULL((SELECT SUM(a.完工量) FROM agg a WHERE a.行id = p.id AND a.工序 = ISNULL(c.当前工序, p.[当前工序])), 0),
    p.[完工状态] = CASE WHEN c.排产 > 0 AND (c.全达标 = 1 OR c.入库 >= c.排产 - 0.0001) THEN N'生产完工'
                        WHEN c.有报工 = 1 THEN N'在制' ELSE N'未开工' END,
    p.[完工时间] = CASE WHEN c.排产 > 0 AND (c.全达标 = 1 OR c.入库 >= c.排产 - 0.0001)
                        THEN ISNULL(p.[完工时间], GETDATE()) ELSE NULL END,
    p.ja = CASE WHEN c.排产 > 0 AND (c.全达标 = 1 OR c.入库 >= c.排产 - 0.0001) THEN 'Y'
                WHEN c.原状态 = N'生产完工' AND c.原结案 = 'Y' THEN 'N'
                ELSE p.ja END,
    p.asp_user2 = N'migration', p.asp_time2 = GETDATE()
FROM dbo.plang p JOIN calc c ON c.行id = p.id;
GO
PRINT N'plang 工序状态已按「工单号+工单行号」逐行重算(幂等)';
GO
-- 自检:不应再有"该行无报工却显示在制/生产完工"的行
DECLARE @bad int = (
    SELECT COUNT(*) FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
      AND ISNULL(p.[完工状态],N'') IN (N'在制', N'生产完工')
      AND NOT EXISTS (
            SELECT 1 FROM dbo.plang_pc pc JOIN dbo.scjl s ON s.gd_id = pc.id
             WHERE pc.plang_id = p.id AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y'
            UNION ALL
            SELECT 1 FROM dbo.scjl s2 WHERE s2.gldh = p.pl_no AND ISNULL(s2.gd_id,0) = 0
             AND ISNULL(s2.asp_cancel,'N') <> 'Y' AND ISNULL(s2.wgzt,'N') = 'Y'
             AND ISNULL(s2.[批次号],N'') = ISNULL(p.[批次号],N'') AND ISNULL(p.[批次号],N'') <> N''
      ));
IF @bad > 0 RAISERROR(N'重算自检失败:仍有 %d 行"无报工却在制"', 16, 1, @bad);
ELSE PRINT N'重算自检通过(无"无报工却在制"的行)';
GO
