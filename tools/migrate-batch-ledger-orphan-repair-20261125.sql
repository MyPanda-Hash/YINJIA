/* ══════════════════════════════════════════════════════════════════════════════
 * migrate-batch-ledger-orphan-repair-20261125.sql
 * 分批送料台账「孤儿占用」回正 —— 2026-11-25
 *
 * ── 客户问的原话 ──
 *   「这上面关联的单据不应该都能看到吗」/「为什么这个记录找不到送料的单」/「SL-2026-10-0053
 *   为什么我能查到这个单据」
 *
 * ── 病根 ──
 *   采购订单表头「送料」浮层(以及分批送料对话框的「已有批次」)只列 yj_doc_batch 台账里
 *   status IN ('ACTIVE','PENDING') 的行,而占用(form_flow_link,ACTIVE)不是每条都有对应台账行:
 *     ① 统一生单/选单/手工建的送料暂收单走 linkBatch(..., batchId=null):**只写占用、不建台账行**;
 *     ② 台账行被释放(RELEASED)或与单据「批次键」对不上时,同样被过滤掉 ——
 *        生产实例:订单 YJ-20260921-10 ↔ 暂收单 SL-2026-10-0053(占用 ACTIVE、单据已审核、
 *        单据批次键 240),浮层只剩 09-28 的「待编号/已作废」和 11-14 的 20261114 两行,
 *        于是出现「已送 35000/35000/5000、浮层里却没有这张单」的怪象。
 *
 * ── 本脚本做什么(只动台账,不动单据) ──
 *   ① 诊断:列出「有 ACTIVE 占用、但没有有效台账行」的 (采购订单, 送料暂收单) 组合;
 *   ② 恢复:台账行存在但状态是 RELEASED(或其他非 ACTIVE/PENDING)且该目标单仍被 ACTIVE 占用
 *           ⇒ 状态回到 ACTIVE、release_time 清空,顺带把 batch_qty 按占用实际量重算;
 *   ③ 补登:完全没有台账行的占用 ⇒ 插一行(batch_no 取占用上的号;号为空则按单据头的批次号;
 *           仍为空 ⇒ status='PENDING' 走「待编号」,绝不凭空造号);
 *   ④ 复检:孤儿数必须 = 0,否则 RAISERROR(整脚本在事务里,失败整体回滚);
 *   ⑤ 附「单据批次号 ≠ 占用批次号」清单(**只报告、不改**) —— 这类差异涉及实物流/材料码上已印的号,
 *      必须人工确认后再定改哪一边,脚本不擅自统一。
 *
 * ── 为什么不擅自改单据上的批次号 ──
 *   SL-2026-10-0053 单据头/行写 SX-20260921、占用写 SX-20261014(2026-10-04~10-19 期间
 *   「供应商编码+日期」那版口径的产物)。实物流/材料码可能已按某一个号贴出去,库里改一边不改另一边
 *   会造成新的对不上 ⇒ 本脚本只保证「台账不缺行」,号的分歧列成清单交人工。
 *
 * ── 幂等 ──
 *   ②③ 都带「仍未被有效台账行覆盖」的守卫,复跑 0 行;④ 的自检也保证复跑必然通过。
 *
 * ── 登记 ──
 *   tools/db-migrations.txt;两账套(HSDZ_MES / HSDZ_MES_TEST)都要执行。
 *   配套代码(同批提交):BatchService.batches() 的 appendOrphanRows —— 即使本脚本还没跑,
 *   界面也会把这类占用显示成「未登记台账」,不会再凭空消失。
 * ══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @srcPanel nvarchar(32) = N'PU_ORDER';
DECLARE @tgtPanel nvarchar(32) = N'QC_RECV';

BEGIN TRAN;

/* ── ① 诊断:孤儿占用清单(占用 ACTIVE、但没有任何 ACTIVE/PENDING 台账行) ───────── */
PRINT N'── ① 诊断:有 ACTIVE 占用、但没有有效台账行的单据(改前) ──';
IF OBJECT_ID('tempdb..#orphan') IS NOT NULL DROP TABLE #orphan;
SELECT l.source_form_no          AS 采购订单号,
       l.target_form_no          AS 送料暂收单,
       SUM(COALESCE(l.linked_quantity, 0)) AS 占用数量,
       MAX(l.batch_no)           AS 占用批次号,
       CONVERT(varchar(19), MIN(l.create_time), 120) AS 最早占用时间,
       COUNT(*)                  AS 占用行数
INTO #orphan
FROM form_flow_link l
WHERE l.link_status = 'ACTIVE'
  AND l.source_panel_code = @srcPanel
  AND l.target_panel_code = @tgtPanel
  AND LTRIM(RTRIM(ISNULL(l.target_form_no, N''))) <> N''
  AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b
                  WHERE b.source_panel_code = l.source_panel_code
                    AND b.source_form_no   = l.source_form_no
                    AND b.target_form_no   = l.target_form_no
                    AND b.status IN ('ACTIVE', 'PENDING'))
GROUP BY l.source_form_no, l.target_form_no;

SELECT 采购订单号, 送料暂收单, 占用数量, 占用批次号, 最早占用时间, 占用行数 FROM #orphan
ORDER BY 最早占用时间, 送料暂收单;

/* ── ② 恢复:台账行被释放(RELEASED)但其目标单仍被稳定占用 ───────────────────── */
PRINT N'── ② 恢复:被释放但仍被占用的台账行 → ACTIVE ──';
UPDATE b
   SET b.status       = CASE WHEN LTRIM(RTRIM(ISNULL(b.batch_no, N''))) = N'' THEN 'PENDING' ELSE 'ACTIVE' END,
       b.release_time = NULL,
       b.batch_qty    = o.占用数量
FROM yj_doc_batch b
JOIN #orphan o
  ON o.采购订单号 = b.source_form_no
 AND o.送料暂收单 = b.target_form_no
WHERE b.source_panel_code = @srcPanel
  AND b.status NOT IN ('ACTIVE', 'PENDING');
DECLARE @fixedReleased int = @@ROWCOUNT;
PRINT N'   恢复行数:' + CAST(@fixedReleased AS nvarchar(20));

/* ── ③ 补登:完全没有台账行的占用(统一生单/选单/手工建的暂收单) ──────────────── */
PRINT N'── ③ 补登:没有台账行的占用 → 插一行 ──';
IF OBJECT_ID('tempdb..#miss') IS NOT NULL DROP TABLE #miss;
SELECT o.采购订单号, o.送料暂收单, o.占用数量, o.占用批次号, o.最早占用时间
INTO #miss
FROM #orphan o
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_batch b
                  WHERE b.source_panel_code = @srcPanel
                    AND b.source_form_no   = o.采购订单号
                    AND b.target_form_no   = o.送料暂收单);

INSERT INTO yj_doc_batch (source_panel_code, source_form_no, batch_seq, batch_no, batch_qty, status,
                          target_panel_code, target_form_no, create_by, create_time, remark)
SELECT @srcPanel,
       m.采购订单号,
       ISNULL(seq.maxSeq, 0) + ROW_NUMBER() OVER (PARTITION BY m.采购订单号 ORDER BY m.最早占用时间, m.送料暂收单),
       NULLIF(LTRIM(RTRIM(ISNULL(NULLIF(m.占用批次号, N''), s.批次号))), N''),
       m.占用数量,
       CASE WHEN LTRIM(RTRIM(ISNULL(NULLIF(m.占用批次号, N''), s.批次号))) = N'' THEN 'PENDING' ELSE 'ACTIVE' END,
       @tgtPanel,
       m.送料暂收单,
       N'system-migrate',
       SYSDATETIME(),
       N'孤儿占用回填(2026-11-25):有 ACTIVE 占用但没有台账行 —— 统一生单/选单/手工建单不写台账'
FROM #miss m
LEFT JOIN sl_recv s ON s.单据编号 = m.送料暂收单
OUTER APPLY (SELECT MAX(b2.batch_seq) AS maxSeq FROM yj_doc_batch b2
             WHERE b2.source_panel_code = @srcPanel AND b2.source_form_no = m.采购订单号) seq;
DECLARE @addedRow int = @@ROWCOUNT;
PRINT N'   补登行数:' + CAST(@addedRow AS nvarchar(20));

/* ── ④ 复检:孤儿必须清零 ─────────────────────────────────────────────────── */
PRINT N'── ④ 复检:仍未被台账覆盖的 ACTIVE 占用 ──';
DECLARE @left int;
SELECT @left = COUNT(*)
FROM form_flow_link l
WHERE l.link_status = 'ACTIVE'
  AND l.source_panel_code = @srcPanel
  AND l.target_panel_code = @tgtPanel
  AND LTRIM(RTRIM(ISNULL(l.target_form_no, N''))) <> N''
  AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b
                  WHERE b.source_panel_code = l.source_panel_code
                    AND b.source_form_no   = l.source_form_no
                    AND b.target_form_no   = l.target_form_no
                    AND b.status IN ('ACTIVE', 'PENDING'));
IF @left > 0
BEGIN
    ROLLBACK;
    RAISERROR(N'孤儿占用复检未通过:仍有 %d 条 ACTIVE 占用没有有效台账行(已回滚)', 16, 1, @left);
    RETURN;
END
PRINT N'   [PASS] 孤儿占用 = 0';

/* ── ⑤ 只报告:单据批次号 ≠ 占用批次号(涉及实物流,不擅自统一) ───────────────── */
PRINT N'── ⑤ 提示:单据批次号与占用批次号不一致(仅报告,不改) ──';
SELECT l.source_form_no AS 采购订单号,
       l.target_form_no AS 送料暂收单,
       MAX(s.批次号)    AS 单据批次号,
       MAX(l.batch_no)  AS 占用批次号
FROM form_flow_link l
JOIN sl_recv s ON s.单据编号 = l.target_form_no
WHERE l.link_status = 'ACTIVE'
  AND l.source_panel_code = @srcPanel
  AND l.target_panel_code = @tgtPanel
  AND LTRIM(RTRIM(ISNULL(l.batch_no, N''))) <> LTRIM(RTRIM(ISNULL(s.批次号, N'')))
GROUP BY l.source_form_no, l.target_form_no
ORDER BY l.source_form_no;

COMMIT;
PRINT N'migrate-batch-ledger-orphan-repair-20261125 完成:台账已回正,浮层可显示全部已送单据';

/* ══════════════════════════════════════════════════════════════════════════════
 * §6 可选(默认关闭):台账批次号 → 单据批次号(消除 ⑤ 列出的分歧)
 *
 *   分歧的来源**已查明**:2026-10-16 的 migrate-align-docdate-batch-time-20261016.sql §1
 *   把「批号/批次号」的日期段统一改成了**单据日期**(⇒ 单据上成了 SX-20260921),但那次只扫
 *   有「批次号」列的表,`form_flow_link.batch_no` 与 `yj_doc_batch.batch_no` 不在其中 ⇒ 占用侧
 *   仍是生单那天的号(如 SX-20261014) —— 于是每张老单都是「单据一个号、占用一个号」,全库性分歧,
 *   不是某一张单被改坏。
 *
 *   为什么默认不打开:这个号可能已经印在材料码上(实物流凭证)。要统一必须现场先确认"实物贴的是
 *   哪个号",再决定改哪一边 —— 盲目执行会制造新的对不上。现场确认「以单据为准」后,把下面
 *   @alignLedgerBatchNo 改成 1 重跑本脚本即可(幂等)。
 * ══════════════════════════════════════════════════════════════════════════════ */
DECLARE @alignLedgerBatchNo bit = 0;   -- ← 现场确认后再置 1
IF @alignLedgerBatchNo = 1
BEGIN
    UPDATE b
       SET b.batch_no = s.批次号
    FROM yj_doc_batch b
    JOIN sl_recv s ON s.单据编号 = b.target_form_no
    WHERE b.source_panel_code = N'PU_ORDER'
      AND b.target_panel_code = N'QC_RECV'
      AND LTRIM(RTRIM(ISNULL(s.批次号, N''))) <> N''
      AND LTRIM(RTRIM(ISNULL(b.batch_no, N''))) <> LTRIM(RTRIM(s.批次号));
    DECLARE @aligned int = @@ROWCOUNT;
    PRINT N'   §6 台账批次号对齐单据:' + CAST(@aligned AS nvarchar(20)) + N' 行';
END
ELSE
    PRINT N'   §6 跳过(默认不改批次号:涉及材料码上的实物流凭证,须现场确认)';

