/* ============================================================================
 * migrate-erp-linekey-repair-20261116.sql
 *   「金蝶同步重建订单明细行 → 行级占用/材料码认不出原来那行」的**存量回填**
 *   (零 DDL / 幂等 / 两账套)
 *
 * 【背景(2026-11-16 用户报障)】
 *   采购订单分批送料弹窗点「确定生单」报:`送料行不存在或已失效:YJ-20261111-06#11039`。
 *   查证:该单明细行 id 已经 11035…11043 变成 11103…11111 —— 金蝶同步每 5 分钟一轮,
 *   只要订单的列表级指纹(审核状态/执行状态/到货状态/备注…)变了,旧实现就把该单明细
 *   **整单 DELETE + 逐行 INSERT**,每写一次就换一批 identity id。
 *   而 MES 的行级占用与打印记录全是**按 id 认行**的:
 *     · form_flow_link.source_line_key = `{单据编号}#{行id}`(采购链已送量 / 销售链已转工单量)
 *     · bl_pu_label.采购订单行id(材料码打印记录 = 分批送料弹窗下层「已打印隔离行」)
 *   ⇒ 行 id 一变,下游单据就"认不出这条订单行":已送量/已转量归零、可送上限虚高(重复送料风险)、
 *     已打印隔离行整片消失。2026-11-16 实测正式库:422 条采购链占用 + 505 条销售链占用失效,
 *     24 条材料码记录失效。
 *
 * 【根因修复(代码)】deploy/sync-core.mjs 的 upsertLines():明细行改按(单据编号 + 行号)合并,
 *   行号相同就 UPDATE、**保住 identity id**,不再整单删插。本脚本只做**存量回填**,
 *   把已经断掉的占用/材料码按「单据编号 + 行号」接回现行行 id。
 *
 * 【回填口径(逐级降级;认不出来就**不猜** —— 与 PlangOrderLine 同一原则)】
 *   ① 目标单明细带「采购订单行号」(送料暂收行 / 来料检验行 / 暂收退料行,2026-11-13 起随行下传)
 *      ⇒ 按行号直接对齐现行订单行(最权威);
 *   ② 采购入库行带 源单编号 + 源单行号 ⇒ 同样按行号对齐;
 *   ③ 行上没有行号的老单(2026-11-13 之前的暂收/检验行):同订单内**该物料只有 1 行**
 *      ⇒ 唯一对应,可回填;
 *   ④ 材料码打印记录:按 打印单表头.采购订单号 + 打印行.采购订单行号 对齐现行订单行;
 *   ⑤ 销售链占用(SO_ORDER → 工单/排产/销售出库):同订单内**该存货只有 1 行** ⇒ 回填
 *      (ERP 订单行重导后 id 会变,这一档与 PlangOrderLine 的兜底口径一致,实测两档 0 冲突)。
 *   同一物料多行的、行号对不上的 —— **留在原地并报数**,交人工判断。错配比不配更危险:
 *   把已送量记到别的行上,可送上限从此是错的,而且没人看得出来。
 *
 * 【幂等】只改「source_line_key 已经指不到现行行」的行;第二次执行 0 行受影响。
 *
 * 【自检】末尾按三组分别报「剩余失效 / 其中本可识别却仍未回填」;
 *   后者 = 0 才算 PASS(否则 RAISERROR severity 16 中止,DbSync 判 FAIL 且不写 yj_schema_log)。
 *   不可识别的剩余量只报数、不判 FAIL(信息不足,规则里已经明确"不猜")。
 *
 * 【依赖列】本脚本引用 sl_recv_detail/qc_insp_detail/qc_return_detail.采购订单行号、
 *   bl_purchase_in.源单编号·源单行号、bl_pu_label.采购订单行号·采购订单行id、bd_pu_label.采购订单号;
 *   另需 bl_pu_order/bl_so_order.行号。三个库(正式/测试/服务器)已核对全部存在(2026-11-16)。
 *   ⚠ 若某账套缺列,本脚本会直接编译失败(而不是静默跳过)—— 这是刻意的:宁可迁移链 FAIL,
 *   也不要"看起来跑过了、其实一条都没回填"。
 *
 * 【两账套】先正式 HSDZ_MES、后测试 HSDZ_MES_TEST。
 * ========================================================================== */

SET NOCOUNT ON;
-- 整支一个事务:要么全部回填、要么全不写(自检不过就回滚,DbSync 判 FAIL 且不写 yj_schema_log)。
-- XACT_ABORT ON:中途任何语句报错都自动回滚,不会把"开着的半截事务"留给同一条连接上的后续脚本。
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @stamp nvarchar(60) = N'migrate-erp-linekey-repair-20261116';
DECLARE @fixRecv int = 0, @fixInsp int = 0, @fixRet int = 0, @fixIn int = 0;
DECLARE @fixPuMat int = 0, @fixSoMat int = 0, @fixLabel int = 0;
DECLARE @leftPu int = 0, @leftSo int = 0, @leftLabel int = 0;
DECLARE @ablePu int = 0, @ableSo int = 0, @ableLabel int = 0;

DECLARE @hasLink bit = CASE WHEN OBJECT_ID(N'dbo.form_flow_link') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasPu bit = CASE WHEN OBJECT_ID(N'dbo.bl_pu_order') IS NOT NULL
                            AND OBJECT_ID(N'dbo.bd_pu_order') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasSo bit = CASE WHEN OBJECT_ID(N'dbo.bl_so_order') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @hasLabel bit = CASE WHEN OBJECT_ID(N'dbo.bl_pu_label') IS NOT NULL
                               AND OBJECT_ID(N'dbo.bd_pu_label') IS NOT NULL THEN 1 ELSE 0 END;

/* 行号比较:采购订单的 行号 在正式库是 nvarchar('6.0000'),目标行下传的 采购订单行号 同形;
   两边都按"数值优先、文本兜底"比,免得 '6' 与 '6.0000' 判成不相等。 */

/* ── ① 目标行带「采购订单行号」:送料暂收行(2026-11-13 起随行下传)───────────────── */
IF @hasLink = 1 AND @hasPu = 1 AND OBJECT_ID(N'dbo.sl_recv_detail') IS NOT NULL
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.sl_recv_detail d
      ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = l.source_form_no
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
     AND ( (TRY_CAST(o.行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(d.采购订单行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(o.行号 AS decimal(18,4)) = TRY_CAST(d.采购订单行号 AS decimal(18,4)))
        OR LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))) )
   WHERE l.source_panel_code = N'PU_ORDER'
     AND l.target_panel_code = N'QC_RECV'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);
  SET @fixRecv = @@ROWCOUNT;
END

/* ── ② 同上:来料检验行 ──────────────────────────────────────────────────────── */
IF @hasLink = 1 AND @hasPu = 1 AND OBJECT_ID(N'dbo.qc_insp_detail') IS NOT NULL
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.qc_insp_detail d
      ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = l.source_form_no
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
     AND ( (TRY_CAST(o.行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(d.采购订单行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(o.行号 AS decimal(18,4)) = TRY_CAST(d.采购订单行号 AS decimal(18,4)))
        OR LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))) )
   WHERE l.source_panel_code = N'PU_ORDER'
     AND l.target_panel_code = N'QC_INSP'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);
  SET @fixInsp = @@ROWCOUNT;
END

/* ── ③ 同上:暂收退料行 ─────────────────────────────────────────────────────── */
IF @hasLink = 1 AND @hasPu = 1 AND OBJECT_ID(N'dbo.qc_return_detail') IS NOT NULL
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.qc_return_detail d
      ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = l.source_form_no
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
     AND ( (TRY_CAST(o.行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(d.采购订单行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(o.行号 AS decimal(18,4)) = TRY_CAST(d.采购订单行号 AS decimal(18,4)))
        OR LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))) )
   WHERE l.source_panel_code = N'PU_ORDER'
     AND l.target_panel_code = N'QC_RETURN'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);
  SET @fixRet = @@ROWCOUNT;
END

/* ── ④ 采购入库行:源单编号 + 源单行号 → 行号 ───────────────────────────────── */
IF @hasLink = 1 AND @hasPu = 1 AND OBJECT_ID(N'dbo.bl_purchase_in') IS NOT NULL
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.bl_purchase_in b
      ON b.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(b.id AS nvarchar(20))
     AND (ISNULL(LTRIM(RTRIM(CAST(b.源单编号 AS nvarchar(80)))), N'') = N''
          OR LTRIM(RTRIM(CAST(b.源单编号 AS nvarchar(80)))) = LTRIM(RTRIM(l.source_form_no)))
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = l.source_form_no
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
     AND ( (TRY_CAST(o.行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(b.源单行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(o.行号 AS decimal(18,4)) = TRY_CAST(b.源单行号 AS decimal(18,4)))
        OR LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(b.源单行号 AS nvarchar(50)))) )
   WHERE l.source_panel_code = N'PU_ORDER'
     AND l.target_panel_code = N'PURCHASE_IN'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);
  SET @fixIn = @@ROWCOUNT;
END

/* ── ⑤ 采购链兜底:老单目标行没有行号 ⇒ 同订单内该物料唯一时唯一对应 ─────────────── */
IF @hasLink = 1 AND @hasPu = 1
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = l.source_form_no
     AND LTRIM(RTRIM(ISNULL(o.物料编码, N''))) = LTRIM(RTRIM(ISNULL(l.inventory_code, N'')))
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
   WHERE l.source_panel_code = N'PU_ORDER'
     AND ISNULL(LTRIM(RTRIM(l.inventory_code)), N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
     AND (SELECT COUNT(*) FROM dbo.bl_pu_order y
           WHERE y.单据编号 = l.source_form_no
             AND LTRIM(RTRIM(ISNULL(y.物料编码, N''))) = LTRIM(RTRIM(l.inventory_code))
             AND ISNULL(y.asp_cancel, 'N') <> 'Y') = 1;
  SET @fixPuMat = @@ROWCOUNT;
END

/* ── ⑥ 销售链兜底:同订单内该存货唯一时唯一对应(与 PlangOrderLine 同一档口径)────── */
IF @hasLink = 1 AND @hasSo = 1
BEGIN
  UPDATE l
     SET l.source_line_key = l.source_form_no + N'#' + CAST(o.id AS nvarchar(20))
    FROM dbo.form_flow_link l
    JOIN dbo.bl_so_order o
      ON o.单据编号 = l.source_form_no
     AND LTRIM(RTRIM(ISNULL(o.存货编码, N''))) = LTRIM(RTRIM(ISNULL(l.inventory_code, N'')))
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
   WHERE l.source_panel_code = N'SO_ORDER'
     AND ISNULL(LTRIM(RTRIM(l.inventory_code)), N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_so_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
     AND (SELECT COUNT(*) FROM dbo.bl_so_order y
           WHERE y.单据编号 = l.source_form_no
             AND LTRIM(RTRIM(ISNULL(y.存货编码, N''))) = LTRIM(RTRIM(l.inventory_code))
             AND ISNULL(y.asp_cancel, 'N') <> 'Y') = 1;
  SET @fixSoMat = @@ROWCOUNT;
END

/* ── ⑦ 材料码打印记录:按「打印单上的采购订单号 + 打印行行号」重指现行订单行 ───────── */
IF @hasLabel = 1 AND @hasPu = 1
BEGIN
  UPDATE lb
     SET lb.采购订单行id = o.id,
         lb.asp_user2 = @stamp,
         lb.asp_time2 = SYSDATETIME()
    FROM dbo.bl_pu_label lb
    JOIN dbo.bd_pu_label h ON h.单据编号 = lb.单据编号
    JOIN dbo.bl_pu_order o
      ON o.单据编号 = h.采购订单号
     AND ISNULL(o.asp_cancel, 'N') <> 'Y'
     AND ( (TRY_CAST(o.行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(lb.采购订单行号 AS decimal(18,4)) IS NOT NULL
            AND TRY_CAST(o.行号 AS decimal(18,4)) = TRY_CAST(lb.采购订单行号 AS decimal(18,4)))
        OR LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(lb.采购订单行号 AS nvarchar(50)))) )
   WHERE NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x WHERE x.id = lb.采购订单行id);
  SET @fixLabel = @@ROWCOUNT;
END

/* ── ⑧ 自检:剩余失效 + 其中「本可识别却仍失效」必须为 0 ────────────────────────── */
IF @hasLink = 1 AND @hasPu = 1
BEGIN
  SELECT @leftPu = COUNT(*)
    FROM dbo.form_flow_link l
   WHERE l.source_panel_code = N'PU_ORDER'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);

  SELECT @ablePu = COUNT(*)
    FROM dbo.form_flow_link l
   WHERE l.source_panel_code = N'PU_ORDER'
     AND ISNULL(LTRIM(RTRIM(l.inventory_code)), N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
     AND (SELECT COUNT(*) FROM dbo.bl_pu_order y
           WHERE y.单据编号 = l.source_form_no
             AND LTRIM(RTRIM(ISNULL(y.物料编码, N''))) = LTRIM(RTRIM(l.inventory_code))
             AND ISNULL(y.asp_cancel, 'N') <> 'Y') = 1;
END

IF @hasLink = 1 AND @hasSo = 1
BEGIN
  SELECT @leftSo = COUNT(*)
    FROM dbo.form_flow_link l
   WHERE l.source_panel_code = N'SO_ORDER'
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_so_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key);

  SELECT @ableSo = COUNT(*)
    FROM dbo.form_flow_link l
   WHERE l.source_panel_code = N'SO_ORDER'
     AND ISNULL(LTRIM(RTRIM(l.inventory_code)), N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_so_order x
                      WHERE x.单据编号 = l.source_form_no
                        AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
     AND (SELECT COUNT(*) FROM dbo.bl_so_order y
           WHERE y.单据编号 = l.source_form_no
             AND LTRIM(RTRIM(ISNULL(y.存货编码, N''))) = LTRIM(RTRIM(l.inventory_code))
             AND ISNULL(y.asp_cancel, 'N') <> 'Y') = 1;
END

IF @hasLabel = 1 AND @hasPu = 1
BEGIN
  SELECT @leftLabel = COUNT(*)
    FROM dbo.bl_pu_label lb
   WHERE NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x WHERE x.id = lb.采购订单行id);

  SELECT @ableLabel = COUNT(*)
    FROM dbo.bl_pu_label lb
    JOIN dbo.bd_pu_label h ON h.单据编号 = lb.单据编号
   WHERE ISNULL(LTRIM(RTRIM(CAST(lb.采购订单行号 AS nvarchar(50)))), N'') <> N''
     AND NOT EXISTS (SELECT 1 FROM dbo.bl_pu_order x WHERE x.id = lb.采购订单行id)
     AND (SELECT COUNT(*) FROM dbo.bl_pu_order y
           WHERE y.单据编号 = h.采购订单号
             AND LTRIM(RTRIM(CAST(y.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(lb.采购订单行号 AS nvarchar(50))))
             AND ISNULL(y.asp_cancel, 'N') <> 'Y') = 1;
END

RAISERROR(N'linekey-repair ① 暂收 %d / ② 检验 %d / ③ 退料 %d / ④ 采购入库 %d / ⑤ 采购·物料唯一 %d / ⑥ 销售·存货唯一 %d / ⑦ 材料码 %d 行已回填',
          10, 1, @fixRecv, @fixInsp, @fixRet, @fixIn, @fixPuMat, @fixSoMat, @fixLabel);
RAISERROR(N'linekey-repair 剩余失效:采购链 %d 条(其中本可识别未回填 %d)/ 销售链 %d 条(%d)/ 材料码 %d 条(%d)',
          10, 1, @leftPu, @ablePu, @leftSo, @ableSo, @leftLabel, @ableLabel);

DECLARE @bad int = CASE WHEN @ablePu > 0 OR @ableSo > 0 OR @ableLabel > 0 THEN 1 ELSE 0 END;

IF @bad = 0
BEGIN
  COMMIT TRANSACTION;
  RAISERROR(N'linekey-repair self-check PASS:可识别的失效占用已全部接回现行行 id(无法识别者见上一行报数)', 10, 1);
END
ELSE
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'migrate-erp-linekey-repair-20261116: 仍有可识别的失效占用未回填(采购 %d / 销售 %d / 材料码 %d),本次修改已全部回滚',
            16, 1, @ablePu, @ableSo, @ableLabel);
END
