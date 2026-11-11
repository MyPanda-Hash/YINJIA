/* ============================================================================
 * migrate-purchase-in-source-backfill-20261111.sql
 * 采购入库单「来源」历史回填:放宽口径,把能追溯的老单全部补上
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11 第三轮):
 *   「为什么之前的单据就没有来源了(主要是想要知道来源来区分不同的入库)」
 *
 * 第一次回填(tools/migrate-purchase-in-source-20261111.sql)只认
 * `form_flow_link.link_status = 'ACTIVE'`,于是**上游单据被作废/删除后链路转成 RELEASED 的单,
 * 明明有出处却被判成"没有来源"** —— 本脚本把这个口径放正:
 *
 *   ① 链路回填(form_flow_link,**任意状态**;同一张入库单有多条时 ACTIVE 优先、再按 id 取第一条)
 *      → 来源 = 来源面板名(送料暂收单 / 来料检验单 / 特采单 / 采购订单),来源单号 = 来源单号;
 *   ② 检验回填(qc_insp_detail.入库单号):检验行上记着"这条入库行出自哪张检验单" → 来源 = 来料检验单;
 *   ③ 暂收回填(sl_recv_detail.入库单号):同口径 → 来源 = 送料暂收单。
 *
 * 只填空值(已有来源的一律不动),幂等;两账套各跑一遍。
 *
 * ⚠ 仍然**补不出来**的那一批,是数据本身没有出处,不是漏填:
 *   库里有一批 `CGRK-…` / `TCGRK-…` 形态的历史入库单(ERP 单号形态,`是否已转ERP='是'` 且
 *   `ERP单号 = 单据编号`),它们从来没走过 MES 的 暂收 → 检验 → 特采 链路,`form_flow_link`
 *   / 检验行 / 暂收行里都没有任何一条指回它们的记录。这类单据界面显示「来源: 无上游单据」
 *   (前端提示的兜底文案),不写进库 —— 免得把猜测当业务事实。
 * ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---- ① 链路回填:任意 link_status,ACTIVE 优先 ---- */
;WITH cand AS (
    SELECT l.target_form_no, l.source_panel_code, l.source_form_no,
           ROW_NUMBER() OVER (PARTITION BY l.target_form_no
                              ORDER BY CASE WHEN l.link_status = 'ACTIVE' THEN 0 ELSE 1 END, l.id) AS rn
      FROM form_flow_link l
     WHERE l.target_panel_code = N'PURCHASE_IN'
)
UPDATE pi
   SET pi.来源单据 = p.panel_name,
       pi.来源单号 = cand.source_form_no,
       pi.asp_user2 = N'migration',
       pi.asp_time2 = GETDATE()
  FROM bd_purchase_in pi
  JOIN cand ON cand.target_form_no = pi.单据编号 AND cand.rn = 1
  JOIN yj_panel p ON p.panel_code = cand.source_panel_code
 WHERE ISNULL(RTRIM(pi.来源单据), '') = ''
   AND ISNULL(RTRIM(p.panel_name), '') <> '';
PRINT N'[回填①] 按 form_flow_link(含 RELEASED)回填:' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 张';
GO

/* ---- ② 检验回填:检验行「入库单号」指回入库单 ---- */
;WITH cand AS (
    SELECT d.入库单号 AS pi_no, d.单据编号 AS insp_no,
           ROW_NUMBER() OVER (PARTITION BY d.入库单号 ORDER BY d.id) AS rn
      FROM qc_insp_detail d
     WHERE ISNULL(RTRIM(d.入库单号), '') <> ''
       AND ISNULL(RTRIM(d.单据编号), '') <> ''
)
UPDATE pi
   SET pi.来源单据 = p.panel_name,
       pi.来源单号 = cand.insp_no,
       pi.asp_user2 = N'migration',
       pi.asp_time2 = GETDATE()
  FROM bd_purchase_in pi
  JOIN cand ON cand.pi_no = pi.单据编号 AND cand.rn = 1
  CROSS JOIN (SELECT panel_name FROM yj_panel WHERE panel_code = N'QC_INSP') p
 WHERE ISNULL(RTRIM(pi.来源单据), '') = '';
PRINT N'[回填②] 按检验行「入库单号」回填:' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 张';
GO

/* ---- ③ 暂收回填:暂收行「入库单号」指回入库单 ---- */
;WITH cand AS (
    SELECT d.入库单号 AS pi_no, d.单据编号 AS recv_no,
           ROW_NUMBER() OVER (PARTITION BY d.入库单号 ORDER BY d.id) AS rn
      FROM sl_recv_detail d
     WHERE ISNULL(RTRIM(d.入库单号), '') <> ''
       AND ISNULL(RTRIM(d.单据编号), '') <> ''
)
UPDATE pi
   SET pi.来源单据 = p.panel_name,
       pi.来源单号 = cand.recv_no,
       pi.asp_user2 = N'migration',
       pi.asp_time2 = GETDATE()
  FROM bd_purchase_in pi
  JOIN cand ON cand.pi_no = pi.单据编号 AND cand.rn = 1
  CROSS JOIN (SELECT panel_name FROM yj_panel WHERE panel_code = N'QC_RECV') p
 WHERE ISNULL(RTRIM(pi.来源单据), '') = '';
PRINT N'[回填③] 按暂收行「入库单号」回填:' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 张';
GO

/* ---- 自检:来源值只能是这四个(或空),不许冒出别的 ---- */
IF EXISTS (SELECT 1 FROM bd_purchase_in
            WHERE ISNULL(RTRIM(来源单据), '') NOT IN (N'', N'送料暂收单', N'来料检验单', N'特采单', N'采购订单'))
    RAISERROR(N'[自检失败] 出现了预期之外的来源值', 16, 1);

/* ---- 取证输出 ---- */
SELECT ISNULL(RTRIM(来源单据), N'(空)') AS 来源, COUNT(*) AS 张数
  FROM bd_purchase_in
 GROUP BY 来源单据
 ORDER BY 张数 DESC;

SELECT COUNT(*) AS 有来源张数 FROM bd_purchase_in WHERE ISNULL(RTRIM(来源单据), '') <> '';
GO
