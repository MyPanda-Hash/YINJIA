/* ═══════════════════════════════════════════════════════════════════════════════
   _fix-so-link-ids.sql —— 修复「订单结转 ↔ 生产工单」占用链的行 id(2026-10-16)

   【起因】服务器上的 jdy-sync 定时任务(sync.mjs,每 5 分钟)在换库后重新拉取了销售订单,
   按 deploy/README.md §7 的口径「行表按单据编号先删后插」⇒ bl_so_order 的行 **换了新 id**
   (实测:本地 6783 → 服务器 8747)。而占用链 form_flow_link.source_line_key 记的是
   「单号#行id」(如 LZW-20260914-03#6783)⇒ **id 对不上 ⇒ 已排产算成 0 ⇒ 订单重新出现在订单结转页**,
   于是界面上「订单结转」与「生产工单」并存。

   【本脚本做什么】只用**业务键**(订单号 + 存货编码,歧义时再加 数量 = linked_quantity 收窄)反查
   订单行**当前**的 id,把 source_line_key 重写成「单号#当前行id」。
   ⚠ 只改这一列:**不新增/不删除工单、不碰 plang、不碰同步器新拉的订单**(那些订单没有占用链)。

   【为什么不删了重建】重建会丢掉 source_quantity/linked_quantity/批次等占用信息;原地改键最小改动。

   【幂等】第 2 段的 UPDATE 带 `source_line_key <> 目标键` 条件 ⇒ 已对得上的行不动,可重复执行。

   【用法(在**服务器库**上跑;开发机的 1433 不对外,连不到服务器的库)】
     ① 先只跑第 1 段(只读),看「待修」「已对得上」「有歧义/无候选」三个数;
     ② 有歧义或候选>1 的先人工看一眼(本地实测 434 条全部唯一命中,预期 0 条);
     ③ 确认后再跑第 2 段。SSMS 里可以整段执行(第 1 段只是 SELECT,不会改数据)。

   【配对的根治手段】下次换库前,把「外部指纹」回填进本地这批 SO/PU 单(按 sync-core.mjs 的
   fingerprintOf 口径从金蝶列表行算),同步器就会判定「无变化 ⇒ 跳过」,不再删插行表 ——
   否则每次 GO DB 换库后都会再断一次,需要重跑本脚本。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;

/* ── 1. 只读核对 ───────────────────────────────────────────────────────────── */
;WITH link AS (
    SELECT f.id, f.source_form_no, f.inventory_code, f.linked_quantity, f.source_line_key,
           ROW_NUMBER() OVER (PARTITION BY f.id ORDER BY
             CASE WHEN ISNULL(l.[数量],0) = ISNULL(f.linked_quantity,0) THEN 0 ELSE 1 END, l.id) AS rn,
           COUNT(*) OVER (PARTITION BY f.id) AS cand,
           l.id AS 目标行id
      FROM form_flow_link f
      JOIN bl_so_order l
        ON l.[单据编号] = f.source_form_no
       AND l.[存货编码] = f.inventory_code
       AND ISNULL(l.[asp_cancel],'N') <> 'Y'
     WHERE f.source_panel_code = 'SO_ORDER'
       AND f.target_panel_code IN ('PLANG','MANU_ORDER')
       AND ISNULL(f.link_status,'') = 'ACTIVE'
)
SELECT
   SUM(CASE WHEN cand = 1 AND source_line_key = source_form_no + N'#' + CAST(目标行id AS nvarchar(20)) THEN 1 ELSE 0 END) AS [已对得上],
   SUM(CASE WHEN cand = 1 AND source_line_key <> source_form_no + N'#' + CAST(目标行id AS nvarchar(20)) THEN 1 ELSE 0 END) AS [待修],
   SUM(CASE WHEN cand > 1 THEN 1 ELSE 0 END) AS [有歧义_多候选],
   SUM(CASE WHEN cand IS NULL THEN 1 ELSE 0 END) AS [无候选_找不到订单行],
   COUNT(*) AS [占用链总数]
  FROM (SELECT id, source_form_no, inventory_code, linked_quantity, source_line_key,
               MAX(cand) AS cand, MAX(目标行id) AS 目标行id
          FROM link GROUP BY id, source_form_no, inventory_code, linked_quantity, source_line_key) t;

-- 明细(只看待修的那批;挑 1 条确认键的样子)
SELECT TOP 20 f.id, f.source_form_no, f.inventory_code, f.linked_quantity,
       f.source_line_key AS 旧键, f.source_form_no + N'#' + CAST(l.id AS nvarchar(20)) AS 目标键
  FROM form_flow_link f
  JOIN bl_so_order l ON l.[单据编号] = f.source_form_no AND l.[存货编码] = f.inventory_code
                    AND ISNULL(l.[asp_cancel],'N') <> 'Y'
 WHERE f.source_panel_code = 'SO_ORDER' AND f.target_panel_code IN ('PLANG','MANU_ORDER')
   AND ISNULL(f.link_status,'') = 'ACTIVE'
   AND f.source_line_key <> f.source_form_no + N'#' + CAST(l.id AS nvarchar(20))
   AND (SELECT COUNT(*) FROM bl_so_order x
         WHERE x.[单据编号] = f.source_form_no AND x.[存货编码] = f.inventory_code
           AND ISNULL(x.[asp_cancel],'N') <> 'Y'
           AND (ISNULL(x.[数量],0) = ISNULL(f.linked_quantity,0)
                OR NOT EXISTS (SELECT 1 FROM bl_so_order y
                                WHERE y.[单据编号] = f.source_form_no AND y.[存货编码] = f.inventory_code
                                  AND ISNULL(y.[asp_cancel],'N') <> 'Y'
                                  AND ISNULL(y.[数量],0) = ISNULL(f.linked_quantity,0)))) = 1
 ORDER BY f.id;
GO

/* ── 2. 修链(确认第 1 段无误后再执行)───────────────────────────────────────
   只匹配「候选恰好 1 条」的行;多候选的一律跳过(留给人工),避免改错。            */
UPDATE f
   SET f.source_line_key = f.source_form_no + N'#' + CAST(l.id AS nvarchar(20))
  FROM form_flow_link f
  JOIN bl_so_order l
    ON l.[单据编号] = f.source_form_no
   AND l.[存货编码] = f.inventory_code
   AND ISNULL(l.[asp_cancel],'N') <> 'Y'
 WHERE f.source_panel_code = 'SO_ORDER'
   AND f.target_panel_code IN ('PLANG','MANU_ORDER')
   AND ISNULL(f.link_status,'') = 'ACTIVE'
   AND f.source_line_key <> f.source_form_no + N'#' + CAST(l.id AS nvarchar(20))
   AND (SELECT COUNT(*) FROM bl_so_order x
         WHERE x.[单据编号] = f.source_form_no AND x.[存货编码] = f.inventory_code
           AND ISNULL(x.[asp_cancel],'N') <> 'Y') = 1;
PRINT N'RESULT: FIX-SO-LINK-IDS 已执行,受影响行数(上一行 rows affected)';
GO

/* ── 3. 复核(应为:待修 = 0)────────────────────────────────────────────────── */
;WITH link AS (
    SELECT f.id, f.source_form_no, f.source_line_key, l.id AS 目标行id
      FROM form_flow_link f
      JOIN bl_so_order l ON l.[单据编号] = f.source_form_no AND l.[存货编码] = f.inventory_code
                        AND ISNULL(l.[asp_cancel],'N') <> 'Y'
     WHERE f.source_panel_code = 'SO_ORDER' AND f.target_panel_code IN ('PLANG','MANU_ORDER')
       AND ISNULL(f.link_status,'') = 'ACTIVE'
)
SELECT SUM(CASE WHEN source_line_key = source_form_no + N'#' + CAST(目标行id AS nvarchar(20)) THEN 1 ELSE 0 END) AS [已对得上],
       SUM(CASE WHEN source_line_key <> source_form_no + N'#' + CAST(目标行id AS nvarchar(20)) THEN 1 ELSE 0 END) AS [仍待修]
  FROM link;
GO
