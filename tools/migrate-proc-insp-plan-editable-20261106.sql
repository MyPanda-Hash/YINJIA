/* migrate-proc-insp-plan-editable-20261106.sql — 制程检验单「检验方案」由"只读固定值"改为"默认值 + 可修改"
 *
 * 任务来源:用户 2026-11-06 第二轮口径(截图红框「检验方案 = 出货控制计划执行」):
 *   「这个检验方案需要能够默认为这个的情况下也能进行修改」
 *   —— 即:新建/自动出单时**默认**写「出货控制计划执行」,但这一格**允许人工改成别的方案**;
 *   此前实现的「字段只读 + 后端每次保存强制写固定值」属于过度收紧,用户已明确要求放开。
 *
 * 本次改动(与代码/前端同批):
 *   ① 本脚本:yj_field「检验方案」editable 0→1(恢复可编辑;required 保持 0,hidden=0,visible=1);
 *      列中文注明改写为"默认值可修改"口径;历史空值行补默认值(幂等)。
 *   ② 后端 ButtonService.save():由"每次保存强制写固定值"改为"**仅空值兜底默认**,不覆盖用户已填/已改的值";
 *      QcInspAutoService.procInspHead():自动出单仍写默认值(初值语义不变)。
 *   ③ 前端无需改代码:纸张按 yj_field 元数据渲染,editable=1 后「检验方案」自动变输入框
 *      (QcProcInspSheet 的 isLockedKey 仍按元数据判只读 —— 单据编号等字段不受影响)。
 *
 * ⚠ 不修改已执行过的 tools/migrate-proc-insp-form-20261106.sql(改字节会让 DbSync 按内容哈希判"变更"重跑,
 *   且它的目标态就是当时的只读口径,保留历史);本脚本是**后续增量**,只把该字段拉回可编辑。
 *
 * 幂等:可重复执行(UPDATE 到目标值 + 空值兜底 UPDATE 天然幂等)。
 * 两账套:先正式 HSDZ_MES,后测试 HSDZ_MES_TEST,各执行一遍。
 */

SET NOCOUNT ON;
GO

-- ═════════════ 1. yj_field:检验方案恢复可编辑(editable 0→1) ═════════════
-- 2026-11-06 第二轮用户口径「默认为这个的情况下也能进行修改」⇒ 字段可编辑。
-- required 仍为 0(不强制填;后端只在空值时写默认),hidden=0/visible=1 保持可见。
PRINT N'== 1. yj_field 检验方案:editable=1(默认值可修改) ==';
UPDATE yj_field
   SET editable = 1, required = 0, hidden = 0, visible = 1
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检验方案';
IF @@ROWCOUNT = 1
  PRINT N'[OK] QC_PROC_INSP.检验方案 → editable=1(可修改;默认值由后端空值兜底)';
ELSE
  PRINT N'[告警] QC_PROC_INSP.检验方案 未更新(行不存在? 见 §3 自检)';
GO

-- ═════════════ 2. 历史空值行补默认值(幂等;已填/已改的值一律不动) ═════════════
PRINT N'== 2. qc_proc_insp_head:仅空值行补默认值「出货控制计划执行」 ==';
DECLARE @defaultPlan nvarchar(50) = N'出货控制计划执行';
UPDATE qc_proc_insp_head SET 检验方案 = @defaultPlan
 WHERE ISNULL(检验方案, N'') = N'';
PRINT N'[OK] 空值行补默认完成:更新 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
-- 证据输出:当前非默认值行数(用户手改过的方案,保留不覆盖)
DECLARE @custom int = (SELECT COUNT(*) FROM qc_proc_insp_head WHERE ISNULL(检验方案, N'') <> @defaultPlan);
PRINT N'[INFO] 当前检验方案非默认值的行数 = ' + CAST(@custom AS nvarchar(10)) + N'(人工改过的方案,保留)';
GO

-- ═════════════ 3. 列中文注明改写为"默认值可修改"口径(缺则补、有则更新) ═════════════
DECLARE @t sysname = N'qc_proc_insp_head', @c sysname = N'检验方案';
DECLARE @d nvarchar(400) = N'检验方案:制程检验单的抽检方案,默认值「出货控制计划执行」(新建/自动出单时由后端写入,仅空值兜底、不覆盖人工改值);2026-11-06 起**可人工修改**';
IF COL_LENGTH(@t, @c) IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
             WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
               AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
END
PRINT N'[OK] qc_proc_insp_head.检验方案 列注明已更新为"默认值可修改"口径';
GO

-- ═════════════ 4. 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log) ═════════════
DECLARE @bad int = 0;
-- 4a 字段行存在且 editable=1 / hidden=0 / visible=1 / required=0
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检验方案'
                 AND editable = 1 AND hidden = 0 AND visible = 1 AND required = 0)
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] yj_field 检验方案 未达到 editable=1/hidden=0/visible=1/required=0', 16, 1); END
-- 4b data_type 仍是文本(可编辑文本框,不是下拉/参照)
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检验方案' AND data_type = N'文本')
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] yj_field 检验方案 data_type 不是「文本」', 16, 1); END
-- 4c 物理列存在
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'检验方案') IS NULL
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_proc_insp_head 缺列 检验方案', 16, 1); END
-- 4d 列注明存在
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'检验方案', 'ColumnId')
                 AND ep.name = 'MS_Description')
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_proc_insp_head.检验方案 缺 MS_Description 中文注明', 16, 1); END

IF @bad > 0
  RAISERROR(N'migrate-proc-insp-plan-editable-20261106 自检失败(%d 项),见上方 [FAIL]', 16, 1, @bad);
ELSE
  PRINT N'migrate-proc-insp-plan-editable-20261106 完成:制程检验单「检验方案」已恢复可编辑(默认值出货控制计划执行,空值兜底)';
GO
