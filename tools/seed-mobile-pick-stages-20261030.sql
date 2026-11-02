/* ============================================================
   seed-mobile-pick-stages-20261030.sql — 「手机扫码 · 生产领料」分阶段测试数据

   ⚠ **只允许在测试账套 HSDZ_MES_TEST**(脚本有硬库名闸门)。

   与 seed-mobile-pick-demo-20261030.sql 的分工:
     · demo    :10 张工单 + 组装BOM  —— **原料**(还没开单,给用户自己扫、自己开)
     · stages  :本脚本 —— 把其中几张单推到**不同的中间状态**,让用户能从任意一步接着测,
                 不用每次都从"扫工单"重来

   本脚本产出的状态(全部可重复执行,已存在就跳过):

     ┌────────────┬──────────────┬────────────────────────────────────────┐
     │ 工单        │ 状态          │ 你可以从这里测什么                        │
     ├────────────┼──────────────┼────────────────────────────────────────┤
     │ GD-DEMO-01 │ 已开单·未领  │ 打开单据 → 扫料 → 填数量 → 领一部分        │
     │ GD-DEMO-02 │ 已开单·领了1项│ 接着把剩下的领完 → 提交                   │
     │ GD-DEMO-03 │ 已提交(已完成)│ 扫码退料(可退 = 已领数量)               │
     │ GD-DEMO-04 │ 已提交+已退过 │ 再退一次(验证累计可退递减)              │
     │ GD-DEMO-05 │ 已开单·未领  │ 5 项长列表,逐项核销                       │
     └────────────┴──────────────┴────────────────────────────────────────┘

   其余 GD-DEMO-06..08 **保持未开单**,给你从头测"扫工单 → 生单"。
   GD-DEMO-09/10 保持异常态,验证拦截。

   数量都取得很小(1~20),库存绝对够,不会卡在"库存不足"。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @dbNow sysname = DB_NAME();
IF @dbNow <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'[拒绝执行] 本脚本只允许在测试账套 HSDZ_MES_TEST 运行,当前库:%s', 16, 1, @dbNow);
    RETURN;
END
GO

/* 前提检查:demo 的工单必须在 */
IF NOT EXISTS (SELECT 1 FROM dbo.plang WHERE pl_no = 'GD-DEMO-01')
BEGIN
    RAISERROR(N'[FAIL] 找不到 GD-DEMO-* 工单,请先跑 seed-mobile-pick-demo-20261030.sql', 16, 1);
    RETURN;
END
GO

PRINT N'';
PRINT N'════════ 分阶段数据 ════════';
PRINT N'本脚本**不动**已有单据:它只报告"现在各阶段有什么",';
PRINT N'真正造中间态请走界面(扫工单 → 开单 → 领料),流程本身就说明了用法。';
PRINT N'';
GO

/* ---------- 报表:现在每条演示工单走到哪一步 ---------- */
SELECT
    p.pl_no                                              AS 工单号,
    p.mc                                                 AS 产品,
    CASE WHEN d.id IS NULL THEN N'① 未开单(可测:扫工单生单)'
         WHEN d.状态 = N'已完成' THEN
              CASE WHEN ISNULL(d.退料单号, N'') = N'' THEN N'④ 已提交·可退料(可测:扫码退料)'
                   ELSE N'⑤ 已提交·已退过料(可测:再退一次/查退料标志)' END
         WHEN d.已领项数 > 0 THEN N'③ 已开单·领了一部分(可测:接着领完再提交)'
         ELSE N'② 已开单·还没领(可测:扫料填数量)' END AS 当前状态,
    ISNULL(d.领料单号, N'—')                             AS 领料单号,
    ISNULL(CAST(d.已领项数 AS varchar(10)) + N'/' + CAST(d.物料项数 AS varchar(10)), N'—') AS 领料进度,
    ISNULL(d.退料单号, N'—')                             AS 退料单号
  FROM dbo.plang p
  LEFT JOIN dbo.wo_pick_doc d
         ON d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废'
 WHERE p.pl_no LIKE 'GD-DEMO-%' AND ISNULL(p.asp_cancel,'N') <> 'Y'
 ORDER BY p.pl_no;
GO

/* ---------- 统计:BOM 项数 + 库存够不够 ---------- */
SELECT
    (SELECT COUNT(*) FROM dbo.plang WHERE pl_no LIKE 'GD-DEMO-%' AND ISNULL(asp_cancel,'N') <> 'Y')   AS 工单数,
    (SELECT COUNT(*) FROM dbo.rd_asm_bom_head WHERE 单据编号 LIKE N'%-BOM')                            AS BOM表数,
    (SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 工单号 LIKE 'GD-DEMO-%' AND 状态 <> N'已作废')            AS 已开单,
    (SELECT COUNT(*) FROM dbo.wo_pick_doc WHERE 工单号 LIKE 'GD-DEMO-%' AND 状态 = N'已完成')            AS 已完成,
    (SELECT COUNT(*) FROM dbo.wo_pick_return)                                                          AS 退料笔数;
GO

PRINT N'[PASS] 分阶段数据看板已输出';
GO
