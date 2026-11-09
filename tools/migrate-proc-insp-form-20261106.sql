/* migrate-proc-insp-form-20261106.sql — 制程检验单(QC_PROC_INSP)纸面字段改造:工序隐藏 / 检验方案固定 / 结果判断下拉
 *
 * 任务来源(用户口径,2026-11-06):
 *   ① 「工序」字段**从界面删除** —— 物理列 qc_proc_insp_head.[工序] 与历史数据**保留**:
 *      自动生单(QcInspAutoService.procInspHead 按报工工序写 head)与「选生产工单」建单仍在写它,
 *      报表参数、参照带回(refCarry 同名字段映射)等下游也还按它取值 —— 隐藏只影响界面,不动数据;
 *   ② 「检验方案」固定写「出货控制计划执行」(用户口径「抽检方案固定写(出货控制计划执行)」):
 *      字段置只读 + 历史单一起归一;代码侧真源 = ButtonService.save() 每次保存强制写固定值
 *      + QcInspAutoService.procInspHead 自动出单也写(见同批代码提交);
 *   ③ 「结果判断」改**下拉框**,选项 = 合格 / 不合格。
 *      2026-11-06 实测出厂检验报告现有写法:`QC_OQC_REPORT.[判定]` 的 dict_sql =
 *      `SELECT v FROM (VALUES (N'合格'),(N'不合格')) AS t(v)`(data_type 为文本)——
 *      本脚本照它的 dict_sql 格式,但 data_type 用「下拉框」:
 *      只有 data_type=下拉框 时 PanelConfigService 才把 dict_sql 解析成 options 下发给前端
 *      (见 fieldSpec:"下拉框" && dictSql != null ⇒ options),前端纸张据此渲染 el-select。
 *
 * 本脚本只改**元数据 + 历史数据归一**(代码接入不在本脚本):
 *   §1 工序 hidden=1 / visible=0(界面删除,列与数据保留);
 *   §2 检验方案 editable=0 / required=0 / 参照源清空 + qc_proc_insp_head 历史单全部回填固定值;
 *   §3 结果判断 data_type='下拉框' + dict_sql(合格/不合格);editable 不动(仍由检验员手选);
 *   §4 三个被改字段的中文注明(缺则补、有则更新;检验方案旧注明是「参照 bs_qc_plan.方案名称」,已过时);
 *   §5 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log):
 *      工序 hidden=1 且 visible=0 / 检验方案 editable=0 / 结果判断 data_type=下拉框 且 dict_sql 含合格+不合格 /
 *      qc_proc_insp_head 中 检验方案 <> 固定值 的行数 = 0。
 *
 * 幂等:可重复执行(UPDATE 到目标值 + 窄条件),重复执行不报错。
 * 两账套:先正式 HSDZ_MES,后测试 HSDZ_MES_TEST,各执行一遍。
 * 已知存量数据:qc_proc_insp_detail.[结果判断] 有 2 行历史脏值「12」(非合格/不合格),
 *   下拉框会原样显示该值,不属本脚本清理范围(要清另开数据修复单)。
 */

SET NOCOUNT ON;
GO

-- ═════════════ 1. 工序:从界面删除(hidden=1 + visible=0;物理列与数据保留) ═════════════
-- 用户口径(2026-11-06):「工序」不要在制程检验单界面出现。
-- ⚠ 只做**界面隐藏**,不删列、不删 yj_field 行:
--   · 自动生单(QcInspAutoService.procInspHead)仍按报工工序写 qc_proc_insp_head.[工序];
--   · 「选生产工单」建单、报表参数($P{工序})、参照带回同名字段映射都还从这一列取值;
--   · hidden=1 同时让通用报表头字段网格 / 明细列跳过它(ReportService 显式过滤 hidden),
--     纸张表头两行也按 hidden 过滤(QcProcInspSheet.headRows 的 !f.hidden),故界面/版式都不再出现。
PRINT N'== 1. 工序:界面隐藏(hidden=1, visible=0) ==';
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'工序';
IF @@ROWCOUNT = 1
  PRINT N'[OK] QC_PROC_INSP.工序 已置 hidden=1 / visible=0(物理列 qc_proc_insp_head.[工序] 与数据保留)';
ELSE
  PRINT N'[告警] QC_PROC_INSP.工序 未更新(行不存在? 见 §5 自检)';
GO

-- ═════════════ 2. 检验方案:只读 + 历史单归一为「出货控制计划执行」 ═════════════
-- 用户口径(2026-11-06):「抽检方案固定写(出货控制计划执行)」—— 这张单没有人工选方案的面。
-- 2a 字段置只读并清掉参照源(现值是 data_type=文本 / ref_panel 等本已为 NULL,这里做幂等归一)
PRINT N'== 2a. 检验方案:置只读并清空参照源 ==';
UPDATE yj_field
   SET editable = 0, required = 0, ref_panel = NULL, ref_field = NULL, display_field = NULL
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检验方案';
IF @@ROWCOUNT = 1
  PRINT N'[OK] yj_field 检验方案 → editable=0 / required=0 / 参照源清空';
ELSE
  PRINT N'[告警] yj_field 检验方案 未更新(行不存在? 见 §5 自检)';
GO

-- 2b 历史单归一(含已作废单):「历史单一起固定」。
--    不回写 asp_user2/asp_time2 —— 批量回填不是"某个人编辑过这张单",不留假留痕。
PRINT N'== 2b. 检验方案:历史单回填固定值 ==';
DECLARE @fixed nvarchar(50) = N'出货控制计划执行';
UPDATE qc_proc_insp_head SET 检验方案 = @fixed
 WHERE ISNULL(检验方案, N'') <> @fixed;
PRINT N'[OK] qc_proc_insp_head 归一完成:更新 ' + CAST(@@ROWCOUNT AS nvarchar(10))
    + N' 行(检验方案 <> N''出货控制计划执行'')';
GO

-- ═════════════ 3. 结果判断:改下拉框(合格 / 不合格) ═════════════
-- 照出厂检验报告 QC_OQC_REPORT.[判定] 的 dict_sql 写法(2026-11-06 实测):
--   SELECT v FROM (VALUES (N'合格'),(N'不合格')) AS t(v)
-- 注意 dict_sql 里的字符串字面量用**两个**单引号转义(N''合格'')。
-- editable 保持 1:结果判断是明细业务值,仍由检验员逐行手选。
PRINT N'== 3. 结果判断:data_type=下拉框 + dict_sql(合格/不合格) ==';
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)'
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'结果判断';
IF @@ROWCOUNT = 1
  PRINT N'[OK] QC_PROC_INSP.结果判断 → data_type=下拉框 + dict_sql(合格/不合格)';
ELSE
  PRINT N'[告警] QC_PROC_INSP.结果判断 未更新(行不存在? 见 §5 自检)';
GO

-- ═════════════ 4. 三个被改字段的中文注明(缺则补、有则更新) ═════════════
DECLARE @t sysname, @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT v.t, v.c, v.d FROM (VALUES
    (N'qc_proc_insp_head', N'工序',
     N'工序:制程检验单所属工序(自动生单/选生产工单按报工工序带入;报表与参照仍取此列)。2026-11-06 起**界面隐藏**(yj_field.hidden=1 / visible=0),物理列与历史数据保留,不是删列'),
    (N'qc_proc_insp_head', N'检验方案',
     N'检验方案:制程检验单**固定值**「出货控制计划执行」(2026-11-06 用户口径「抽检方案固定写(出货控制计划执行)」)。字段只读(editable=0),保存与自动生单均由后端写固定值,不接受手工改动'),
    (N'qc_proc_insp_detail', N'结果判断',
     N'结果判断:明细每行的判定结论,2026-11-06 起为**下拉框**,选项 = 合格 / 不合格(dict_sql 与出厂检验报告「判定」同口径);仍由检验员逐行手选')
  ) AS v(t, c, d);
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @t, @c, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 工序 / 检验方案 / 结果判断 三条列注明已写入(缺则补、有则更新)';
GO

-- ═════════════ 5. 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log;全 PASS 才 PRINT) ═════════════
DECLARE @bad int = 0;

-- 5a 工序:yj_field 行仍在,且 hidden=1 / visible=0
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'工序' AND hidden = 1 AND visible = 0)
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] QC_PROC_INSP.工序 应为 hidden=1 且 visible=0(yj_field 行本身也必须保留,不得删除)', 16, 1);
END

-- 5b 工序:物理列仍在(只隐藏不删列)
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'工序') IS NULL
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] qc_proc_insp_head.[工序] 物理列不存在(本改造只隐藏界面,不允许删列)', 16, 1);
END

-- 5c 检验方案:字段存在、只读、参照源已清
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检验方案'
                 AND editable = 0 AND ISNULL(ref_panel, N'') = N'' AND ISNULL(ref_field, N'') = N'')
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] QC_PROC_INSP.检验方案 应为 editable=0 且参照源为空(ref_panel/ref_field)', 16, 1);
END

-- 5d 结果判断:data_type=下拉框,且 dict_sql 同时含 合格 / 不合格
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'结果判断'
                 AND data_type = N'下拉框' AND dict_sql LIKE N'%合格%' AND dict_sql LIKE N'%不合格%')
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] QC_PROC_INSP.结果判断 应为 data_type=下拉框 且 dict_sql 含 合格/不合格', 16, 1);
END

-- 5e 历史单归一:qc_proc_insp_head 中 检验方案 <> 固定值 的行数必须 = 0
DECLARE @left int = (SELECT COUNT(*) FROM qc_proc_insp_head
                     WHERE ISNULL(检验方案, N'') <> N'出货控制计划执行');
IF @left <> 0
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] qc_proc_insp_head 仍有 %d 行 检验方案 <> N''出货控制计划执行''(历史单未归一)', 16, 1, @left);
END

IF @bad > 0
  RAISERROR(N'migrate-proc-insp-form-20261106 自检失败(%d 项),见上方 [FAIL]', 16, 1, @bad);
ELSE
  PRINT N'migrate-proc-insp-form-20261106 完成:制程检验单纸面字段就绪'
      + N'(工序 界面隐藏且列/数据保留 / 检验方案 只读 + 历史单归一 / 结果判断 下拉 合格-不合格 / 3 条列注明)';
GO
