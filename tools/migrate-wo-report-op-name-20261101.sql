/* ============================================================
   migrate-wo-report-op-name-20261101.sql
   工序报工单「工序」参照:选完落**工序名称**,不再落工序编码
   ============================================================

   用户报障(2026-11-01):
     工序报工单选「工序」后,单里存的是**编码** OP-CX;提交/审核时被路线校验拦下——
     「工序「OP-CX」不在工单 GD-2026-10-0226-1 的工艺路线「GY-CB-STD」内(成型→切炭→组装),不能报工」。
     用户原话:「当前报工的原先是名称不是编码,选择后填入当前的应该是工序名称」。

   根因:
     yj_field 里三张报工相关面板的 gxdm(工序)参照配的是 ref_field=工序编码 ⇒ 参照弹窗把
     行对象的 工序编码(OP-CX)写进 gxdm。但 scjl.gxdm 的业务口径从头就是**工序名称**
     (全库实测:成型 385 / 切炭 384 / 组装 384 行;只有误选出来的 1 行是编码),
     路线校验(bs_route.工序名称)、前道不跳序判断、完工明细/报工记录、转序判据全部按**名称**比对。

   处置:
     ① 元数据:WO_REPORT(工序报工单)/ WO_REPORT_LIST(报工记录)/ WO_COMPLETION_LIST(完工明细)
        三张面板的 gxdm 参照 ref_field / display_field 统一改「工序名称」;
     ② 存量修数:scjl.gxdm 里值恰好等于 bs_op.工序编码 的行,改成对应 工序名称
        (工序编码唯一才改,歧义跳过并打印)。

   幂等(重复执行为 0 行改动);两个账套都要执行。
   ============================================================ */
SET NOCOUNT ON;

/* ---------- ① 元数据:gxdm 参照改落「工序名称」 ---------- */
DECLARE @fixed int = 0;
UPDATE f SET f.ref_field = N'工序名称', f.display_field = N'工序名称'
FROM dbo.yj_field f
WHERE f.col_name = N'gxdm' AND f.ref_panel = N'OP'
  AND f.panel_code IN (N'WO_REPORT', N'WO_REPORT_LIST', N'WO_COMPLETION_LIST')
  AND ISNULL(f.ref_field, N'') <> N'工序名称';
SET @fixed = @@ROWCOUNT;
PRINT N'[① 元数据] 工序参照改落名称: ' + CAST(@fixed AS nvarchar(10)) + N' 行';

/* 自检:上述三张面板(存在的)gxdm 参照必须全部是 工序名称 */
DECLARE @want int = (SELECT COUNT(*) FROM dbo.yj_field
                     WHERE col_name = N'gxdm' AND ref_panel = N'OP'
                       AND panel_code IN (N'WO_REPORT', N'WO_REPORT_LIST', N'WO_COMPLETION_LIST'));
DECLARE @ok int = (SELECT COUNT(*) FROM dbo.yj_field
                   WHERE col_name = N'gxdm' AND ref_panel = N'OP'
                     AND panel_code IN (N'WO_REPORT', N'WO_REPORT_LIST', N'WO_COMPLETION_LIST')
                     AND ref_field = N'工序名称' AND display_field = N'工序名称');
DECLARE @miss int = @want - @ok;
IF @miss <> 0 RAISERROR(N'[FAIL] 工序参照仍有 %d 行没改成 工序名称', 16, 1, @miss);

/* ---------- ② 存量修数:scjl.gxdm 误落的「工序编码」→「工序名称」 ---------- */
DECLARE @bad int = (SELECT COUNT(*) FROM dbo.scjl s
                    WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
                      AND EXISTS (SELECT 1 FROM dbo.bs_op o
                                  WHERE o.工序编码 = s.gxdm AND ISNULL(o.asp_cancel, 'N') <> 'Y'
                                    AND (SELECT COUNT(*) FROM dbo.bs_op o2
                                         WHERE o2.工序编码 = s.gxdm AND ISNULL(o2.asp_cancel, 'N') <> 'Y') = 1));
PRINT N'[② 修数] 待改(scjl.gxdm=工序编码): ' + CAST(@bad AS nvarchar(10)) + N' 行';

UPDATE s SET s.gxdm = o.工序名称
FROM dbo.scjl s
JOIN dbo.bs_op o ON o.工序编码 = s.gxdm AND ISNULL(o.asp_cancel, 'N') <> 'Y'
WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
  AND (SELECT COUNT(*) FROM dbo.bs_op o2
       WHERE o2.工序编码 = s.gxdm AND ISNULL(o2.asp_cancel, 'N') <> 'Y') = 1;
PRINT N'[② 修数] 实改: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* 自检:不允许再有 gxdm 等于(唯一)工序编码 的行 */
DECLARE @left int = (SELECT COUNT(*) FROM dbo.scjl s
                     WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
                       AND EXISTS (SELECT 1 FROM dbo.bs_op o
                                   WHERE o.工序编码 = s.gxdm AND ISNULL(o.asp_cancel, 'N') <> 'Y'
                                     AND (SELECT COUNT(*) FROM dbo.bs_op o2
                                          WHERE o2.工序编码 = s.gxdm AND ISNULL(o2.asp_cancel, 'N') <> 'Y') = 1));
IF @left > 0 RAISERROR(N'[FAIL] 仍有 %d 行工序值为编码', 16, 1, @left);

PRINT N'[OK] 工序参照已改落名称,存量编码值已回改为名称';
