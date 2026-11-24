/* =====================================================================================
   分批送料「占用自洽」修数 —— 2026-11-24

   病根（客户报障：「生单数量是 4000，这里只有 200」）：
     form_flow_link.linked_quantity 与 yj_doc_batch.batch_qty 只在**生单那一刻**按「本次送料量」
     写一次；之后在草稿里把暂收单行的「数量」改掉，没有任何路径回写占用 ⇒ 该订单行的「已送」
     停在生单时的数、「剩余」被吃光。生产实例：
       采购订单 YJ-20261103-06 行6 二十寸纸箱 YJ-GL-012
         · 分批送料：数量 4000 / 已送 4000 / 剩余 0（全靠 50% 超送额度）
         · 暂收单 SL-2026-11-0028 实际只有 200、采购入库单 PI-2026-11-0034 也只有 200
      即：多算了 3800 的「已送」，客户在单据上看到的就是 4000 vs 200。

   本脚本做两件事（幂等，可重复执行）：
     ① 送料暂收单(靶面板 QC_RECV)的 ACTIVE 占用 → 按该行**当前数量**回写 linked_quantity；
        行已软删/不存在 ⇒ 占用置 RELEASED（把额度还给订单行）。
     ② 涉及的批次台账 batch_qty 重算 = 该批次下所有 ACTIVE 占用对应的暂收行数量合计。

   ⚠ 只动 target_panel_code='QC_RECV' 的占用（采购订单 → 送料暂收单）。
     「检验 → 采购入库 / 暂收退回」那条链的占用是合格/不合格数量语义，由检验单审核侧维护，本脚本不碰。

   两账套都要执行（正式 + 测试）；脚本自带「改前/改后」统计，末尾自检必须 差额=0。
   ===================================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '=== ① 改前统计（ACTIVE 占用 vs 暂收行实际数量）===';

WITH l AS (
    SELECT f.id,
           f.linked_quantity,
           TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int) AS rid
      FROM form_flow_link f
     WHERE f.target_panel_code = 'QC_RECV'
       AND f.link_status = 'ACTIVE'
)
SELECT COUNT(*)                                                                    AS 占用行数,
       SUM(CASE WHEN d.id IS NULL THEN 1 ELSE 0 END)                               AS 行已不存在,
       SUM(CASE WHEN d.id IS NOT NULL AND d.asp_cancel = 'Y' THEN 1 ELSE 0 END)     AS 行已作废,
       SUM(CASE WHEN d.id IS NOT NULL AND ISNULL(d.asp_cancel,'N') <> 'Y'
                 AND ABS(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005
                THEN 1 ELSE 0 END)                                                 AS 数量不一致,
       SUM(CASE WHEN d.id IS NOT NULL AND ISNULL(d.asp_cancel,'N') <> 'Y'
                THEN ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0) ELSE 0 END)     AS 差额合计
  FROM l LEFT JOIN sl_recv_detail d ON d.id = l.rid;
GO

PRINT '=== ② 释放「行已删除/作废」的占用（额度还给订单行）===';

UPDATE f
   SET f.link_status = 'RELEASED',
       f.release_time = SYSDATETIME()
  FROM form_flow_link f
 OUTER APPLY (
        SELECT d.id, ISNULL(d.asp_cancel,'N') AS cx
          FROM sl_recv_detail d
         WHERE d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 ) d
 WHERE f.target_panel_code = 'QC_RECV'
   AND f.link_status = 'ACTIVE'
   AND (d.id IS NULL OR d.cx = 'Y');

PRINT '   已释放占用行数: ' + CAST(@@ROWCOUNT AS varchar(20));
GO

PRINT '=== ③ 占用数量 = 暂收行当前数量（回写 linked_quantity）===';

UPDATE f
   SET f.linked_quantity = d.数量
  FROM form_flow_link f
  JOIN sl_recv_detail d
    ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.target_panel_code = 'QC_RECV'
   AND f.link_status = 'ACTIVE'
   AND ISNULL(d.asp_cancel,'N') <> 'Y'
   AND ABS(ISNULL(f.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005;

PRINT '   已回写占用行数: ' + CAST(@@ROWCOUNT AS varchar(20));
GO

PRINT '=== ④ 批次台账 batch_qty = 该批次 ACTIVE 占用对应暂收行数量合计 ===';

UPDATE b
   SET b.batch_qty = s.qty
  FROM yj_doc_batch b
  JOIN (
        SELECT f.batch_id AS bid, SUM(ISNULL(d.数量,0)) AS qty
          FROM form_flow_link f
          JOIN sl_recv_detail d
            ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
         WHERE f.target_panel_code = 'QC_RECV'
           AND f.link_status = 'ACTIVE'
           AND ISNULL(d.asp_cancel,'N') <> 'Y'
           AND f.batch_id IS NOT NULL
         GROUP BY f.batch_id
 ) s ON s.bid = b.id
 WHERE ABS(ISNULL(CAST(b.batch_qty AS decimal(18,4)),0) - s.qty) > 0.00005;

PRINT '   已校正批次台账行数: ' + CAST(@@ROWCOUNT AS varchar(20));
GO

PRINT '=== ⑤ 自检（必须全 0：不一致 0 行、差额 0）===';

WITH l AS (
    SELECT f.id,
           f.linked_quantity,
           TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int) AS rid
      FROM form_flow_link f
     WHERE f.target_panel_code = 'QC_RECV'
       AND f.link_status = 'ACTIVE'
)
SELECT COUNT(*) AS 仍不一致行数,
       SUM(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) AS 仍差额合计
  FROM l LEFT JOIN sl_recv_detail d ON d.id = l.rid
 WHERE d.id IS NULL
    OR ISNULL(d.asp_cancel,'N') = 'Y'
    OR ABS(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005;
GO
