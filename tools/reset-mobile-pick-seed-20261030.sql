/* ============================================================
   reset-mobile-pick-seed-20261030.sql — 把「手机扫码测试数据」整体复位

   ⚠ 只动**测试脚本产出的**数据,判据严格:
     · 工单号 GD-2026-10-*(由订单结转生成)且台账里没有已完成的单;
     · 以及 GD-STG-* / GD-DEMO-* 演示工单。

   ★ 为什么需要这个脚本(踩坑记录)
     反复造数时代码里的作业顺序很容易漏一步,实际踩到的三个坑:
       ① 只删 plang 不清 form_flow_link 的 SO_ORDER 占用 ⇒ 订单行永远显示
          "已全部转出",待结转接口返回 0 行,后续全部跳过;
       ② 先删台账再删工单,会让"有无台账"的判据反过来,工单删不掉;
       ③ 没删 wo_process_line 会留下孤儿工序行。
     ⇒ 统一按下面顺序一次做完:占用 → 工序台账 → 台账表 → 退料 → 明细 → 单头 → 工单。

   幂等:重复执行结果一致(已清空时各项 0 行)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES_TEST;
GO

DECLARE @link int = 0, @proc int = 0, @ledger int = 0, @ret int = 0,
        @blOut int = 0, @bdOut int = 0, @wo int = 0;

/* ---------- ① 订单行占用登记(必须先清,否则待结转额度不恢复) ---------- */
DELETE f
  FROM dbo.form_flow_link f
 WHERE f.source_panel_code = N'SO_ORDER'
   AND f.target_panel_code IN (N'MANU_ORDER', N'PLANG')
   AND (
        f.target_form_no LIKE N'GD-2026-10-%'
     OR f.target_line_key LIKE N'GD-2026-10-%'
   );
SET @link = @@ROWCOUNT;

/* ---------- ② 工序台账(工单行被删后就是孤儿) ---------- */
DELETE w
  FROM dbo.wo_process_line w
 WHERE w.工单号 LIKE N'GD-2026-10-%'
    OR w.工单号 LIKE N'GD-STG-%'
    OR w.工单号 LIKE N'GD-DEMO-%';
SET @proc = @@ROWCOUNT;

/* ---------- ③ 退料台账 ---------- */
DELETE r
  FROM dbo.wo_pick_return r
 WHERE r.领料单号 IN (SELECT 领料单号 FROM dbo.wo_pick_doc
                       WHERE 工单号 LIKE N'GD-2026-10-%'
                          OR 工单号 LIKE N'GD-STG-%'
                          OR 工单号 LIKE N'GD-DEMO-%');
SET @ret = @@ROWCOUNT;

/* ---------- ④ 领料台账 ---------- */
DELETE d
  FROM dbo.wo_pick_doc d
 WHERE d.工单号 LIKE N'GD-2026-10-%'
    OR d.工单号 LIKE N'GD-STG-%'
    OR d.工单号 LIKE N'GD-DEMO-%';
SET @ledger = @@ROWCOUNT;

/* ---------- ⑤ 材料出库单(明细 → 单头 → 状态) ---------- */
DECLARE @outs TABLE (no nvarchar(60) PRIMARY KEY);
INSERT INTO @outs (no)
SELECT DISTINCT h.单据编号
  FROM dbo.bd_material_out h
 WHERE h.加工单号 LIKE N'GD-2026-10-%'
    OR h.加工单号 LIKE N'GD-STG-%'
    OR h.加工单号 LIKE N'GD-DEMO-%';

DELETE l FROM dbo.bl_material_out l WHERE l.单据编号 IN (SELECT no FROM @outs);
SET @blOut = @@ROWCOUNT;
DELETE s FROM dbo.yj_doc_status s WHERE s.doc_no IN (SELECT no FROM @outs);
DELETE h FROM dbo.bd_material_out h WHERE h.单据编号 IN (SELECT no FROM @outs);
SET @bdOut = @@ROWCOUNT;

/* ---------- ⑥ 工单本身 ---------- */
DELETE p
  FROM dbo.plang p
 WHERE p.pl_no LIKE N'GD-2026-10-%'
    OR p.pl_no LIKE N'GD-STG-%'
    OR p.pl_no LIKE N'GD-DEMO-%';
SET @wo = @@ROWCOUNT;

PRINT N'[重置] 占用 ' + CAST(@link AS nvarchar(10))
    + N' / 工序 ' + CAST(@proc AS nvarchar(10))
    + N' / 退料 ' + CAST(@ret AS nvarchar(10))
    + N' / 台账 ' + CAST(@ledger AS nvarchar(10))
    + N' / 出库明细 ' + CAST(@blOut AS nvarchar(10))
    + N' / 出库单 ' + CAST(@bdOut AS nvarchar(10))
    + N' / 工单 ' + CAST(@wo AS nvarchar(10));
GO

/* ---------- 自检 ---------- */
DECLARE @left int;
SELECT @left = COUNT(*) FROM dbo.plang
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND (pl_no LIKE N'GD-2026-10-%' OR pl_no LIKE N'GD-STG-%' OR pl_no LIKE N'GD-DEMO-%');
IF @left > 0
   PRINT N'[WARN] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 张测试工单未清';
ELSE
   PRINT N'[PASS] 测试工单已清空,BOM(AP-REAL-*)保留';
GO
