/* ============================================================================
 * migrate-qc-recv-stock-visible-20261112.sql
 * 送料暂收单「现存量」取消隐藏(用户口径 2026-11-12:「送料暂收别隐藏」)
 * ----------------------------------------------------------------------------
 * 背景:2026-11-12 采购链「现存量」贯通改造里,送料暂收行(`sl_recv_detail.现存量`)原本是
 *   hidden=1 / visible=0(2026-09-22 起一直藏着);用户在这一轮明确要求**送料暂收单不要隐藏**,
 *   其余三站(来料检验单 / 暂收退回单 / 特采单)继续保持隐藏。
 *
 * 做法(只动 yj_field 的两个显示开关,**物理列与数据一个字节不改**):
 *   QC_RECV + 现存量 ⇒ visible=1、hidden=0、editable=0(只读:值由采购订单带入,人不该手改)。
 *   seq 保持 360 不变 ⇒ 明细表格里它排在「备注」之后,列在最末尾,
 *   **不打乱既有的 22 列顺序**(要挪位置另开一条 seq 调整的迁移)。
 *
 * 幂等:按 panel_code + col_name 精确定位,重跑行数为 0。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-recv-stock-visible-20261112 ==';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RECV' AND col_name = N'现存量')
    RAISERROR(N'[前置] QC_RECV 没有「现存量」字段行 —— 请先执行 migrate-po-stock-fullchain-20261112.sql', 16, 1);

UPDATE yj_field
   SET visible = 1, hidden = 0, editable = 0
 WHERE panel_code = N'QC_RECV' AND col_name = N'现存量'
   AND (ISNULL(visible, 0) <> 1 OR ISNULL(hidden, 1) <> 0 OR ISNULL(editable, 1) <> 0);
PRINT N'[OK] QC_RECV.现存量 → visible=1 hidden=0 editable=0(' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行)';

/* 自检:送料暂收可见;其余三站仍隐藏 */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_RECV' AND col_name = N'现存量'
      AND visible = 1 AND hidden = 0) <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_INSP', N'QC_RETURN', N'QC_TC_IN')
      AND col_name = N'现存量' AND hidden = 0) <> 0 SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'送料暂收「现存量」显示开关自检失败(应为「暂收可见、其余三站隐藏」)', 16, 1);
ELSE PRINT N'送料暂收单「现存量」已可见(表格最后一列,只读);检验/退回/特采仍隐藏';
GO
