/* ============================================================
   migrate-plang-order-demand-20261031.sql — 2026-10-31
   订单结转转工单:工单「需求数量」口径修正(存量数据)

   用户口径(2026-10-30/31):
     · 需求数量 = 从销售订单带过来的**本次转单数量**;
       转单数量(plang.pl_sl) = 从订单结转**转进本工单**的数量。
     · 同一销售订单行分多次转单 ⇒ 每次直接生成**一张新工单号**,工单行号 = 订单行号,
       工单上带 订单号(plang.od_no)+ 订单行 id(plang.od_xc,历史口径)保持订单追溯。
       代码侧见 QuickScheduleService.createFromOrderLine(2026-10-31 改)。

   为什么要修存量:
     旧代码把 xq_sl 写成**整条订单行数量**(bl_so_order.数量),而 pl_sl 与占用链写的是本次转单数量 ⇒
     同一订单行分两次转(如 200 里先转 100 再转 100)时,两张工单行**各自显示需求 200**,
     订单需求被重复计(2026-10-30 用户报障:同一销售订单转两次,两张单需求数量都是 200)。

   判据(为什么这样判才安全):
     · 本工单行有 ACTIVE 的 SO_ORDER→PLANG 占用链(转单写入的 form_flow_link),且
       xq_sl > 占用合计 + 0.0001;
     · **完整转出**的行 xq_sl = 占用 ⇒ 不动;
     · **切单**父子行 xq_sl 与占用链同步核减(WorkOrderSplitService.splitLink)⇒ 相等 ⇒ 不动;
     · 已排产但没转满的行(pl_sl < 占用)也按占用修 —— 占用才是"转进本工单的数量";
     · 没有订单占用链的行(**手机端小程序/参考库直写**的工单)不动:没有 SO 占用可对照。

   修法(幂等):
     ① xq_sl = 占用合计 L;yl = max(0, L − pl_sl)(与各写入方的「余量 = 需求 − 排产」一致);
     ② 自检:修复后「xq_sl > 占用合计」的越界行数必须 = 0(非 0 会打印 [FAIL] 人工看)。

   ⚠ 不改 pl_xc:历史「同一工单号多行」的行号已参与占用链键(pl_no#pl_xc),
     改号会拆断 form_flow_link;新转单由代码保证「一张新工单 + 行号 = 订单行号」。
   ⚠ 不动 od_xc:该列沿用历史口径存**订单行 id**(bl_so_order.id),工单列表/追溯按它 join
     出「订单行号」显示 —— 存量数据本来就对,不需要洗。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.plang', N'U') IS NULL OR OBJECT_ID(N'dbo.form_flow_link', N'U') IS NULL
BEGIN
    PRINT N'[skip] plang / form_flow_link 不存在,本脚本无可执行对象';
END
ELSE
BEGIN
    /* ---------- 修复前:盘点待修行(留证) ---------- */
    PRINT N'[1/3] 修复前盘点:需求数量 > SO→PLANG 占用合计 的工单行 …';
    ;WITH L0 AS (
        SELECT p.id AS pid, SUM(ISNULL(f.linked_quantity,0)) AS linked
          FROM dbo.plang p
          JOIN dbo.form_flow_link f
            ON f.target_panel_code = 'PLANG' AND f.target_form_no = p.pl_no
           AND (f.target_line_key = p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0))
                OR f.target_line_key LIKE p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0)) + N'#%')
           AND f.link_status = 'ACTIVE'
         WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
           AND ISNULL(p.od_no, N'') <> N''
         GROUP BY p.id
    )
    SELECT COUNT(*) AS 待修行数,
           CAST(SUM(ISNULL(p.xq_sl,0) - L0.linked) AS decimal(18,4)) AS 虚高合计,
           CAST(SUM(L0.linked) AS decimal(18,4)) AS 真实转单合计
      FROM dbo.plang p
      JOIN L0 ON L0.pid = p.id
     WHERE ISNULL(p.xq_sl,0) > L0.linked + 0.0001
       AND L0.linked > 0;

    /* ---------- ① 修 xq_sl / yl ---------- */
    DECLARE @fixed int = 0;
    ;WITH L AS (
        SELECT p.id AS pid, SUM(ISNULL(f.linked_quantity,0)) AS linked
          FROM dbo.plang p
          JOIN dbo.form_flow_link f
            ON f.target_panel_code = 'PLANG' AND f.target_form_no = p.pl_no
           AND (f.target_line_key = p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0))
                OR f.target_line_key LIKE p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0)) + N'#%')
           AND f.link_status = 'ACTIVE'
         WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
           AND ISNULL(p.od_no, N'') <> N''
         GROUP BY p.id
    )
    UPDATE p
       SET xq_sl = L.linked,
           yl    = CASE WHEN L.linked > ISNULL(p.pl_sl,0) THEN L.linked - ISNULL(p.pl_sl,0) ELSE 0 END
      FROM dbo.plang p
      JOIN L ON L.pid = p.id
     WHERE ISNULL(p.xq_sl,0) > L.linked + 0.0001
       AND L.linked > 0;
    SET @fixed = @@ROWCOUNT;
    PRINT N'[2/3] 已修 xq_sl 行数 = ' + CONVERT(nvarchar(10), @fixed);

    /* ---------- ② 自检:越界行必须 = 0 ---------- */
    DECLARE @bad int = 0;
    ;WITH L2 AS (
        SELECT p.id AS pid, SUM(ISNULL(f.linked_quantity,0)) AS linked
          FROM dbo.plang p
          JOIN dbo.form_flow_link f
            ON f.target_panel_code = 'PLANG' AND f.target_form_no = p.pl_no
           AND (f.target_line_key = p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0))
                OR f.target_line_key LIKE p.pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(p.pl_xc,0)) + N'#%')
           AND f.link_status = 'ACTIVE'
         WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
           AND ISNULL(p.od_no, N'') <> N''
         GROUP BY p.id
    )
    SELECT @bad = COUNT(*)
      FROM dbo.plang p
      JOIN L2 ON L2.pid = p.id
     WHERE ISNULL(p.xq_sl,0) > L2.linked + 0.0001
       AND L2.linked > 0;
    PRINT N'[3/3] 自检:修复后 需求数量 > 占用合计 的越界行数 = ' + CONVERT(nvarchar(10), @bad)
          + CASE WHEN @bad = 0 THEN N'  [PASS]' ELSE N'  [FAIL] 请人工核对这些行' END;
END
