/* migrate-oqc-twolevel-20261104.sql — 出厂检验报告(QC_OQC_REPORT)接入两级审批:编制 / 审核 / 批准 三格自动落值
 *
 * 任务来源:task-1「出厂检验报告(QC_OQC_REPORT)二级审批:后端接入 + 元数据迁移」。
 * 参考实现:tools/migrate-qc-tcin-twolevel.sql(特采单)、tools/migrate-qc-docs-twolevel.sql(7 张质量单据)。
 *
 * 用户口径(2026-11-04):
 *   ① 出厂检验报告接入与特采单(QC_TC_IN)同款的**两级审批**:
 *      一级 = 审批通过(有该面板「审核反审核」权 yj_role_panel.can_approve='Y' 的角色 ∪ 管理员),
 *      二级 = **超级管理员批准**(yj_user.is_admin='Y');两级必须各点一次(同一人也两次);
 *   ② 纸面(受控表单 YJ-QR-05/A1)签署行三格:检验员 = **编制**(提交审批时后端自动写提交人、只读)、
 *      审核 = 一级审批人、批准 = 超级管理员(二级批准通过才落值);
 *   ③ 纸面第一格受控表单上印的是「检验员」而不是「编制人」⇒ 列名沿用 `检验员`,语义按编制处理
 *      —— 代码侧同批提交:ButtonService.QC_DOC_PREPARER 增加 "QC_OQC_REPORT" → "检验员"
 *      (ADMIN_L2_PANELS / TWO_LEVEL_PANELS 均由该 Map 派生,OQC 自动获得两级审批全套:直审拦截、
 *      提交写编制、一级写审核人/审核时间、二级写审批人/审批时间、驳回/弃审清签名格、save 剥离签名格入参);
 *   ④ 三格全自动、不可手改:yj_field editable=0 + 后端 save() 剥离入参,真源只有审批流动作。
 *
 * 本脚本只改**元数据**(代码接入不在本脚本):
 *   §1 qc_oqc_head 增加 [审批人] nvarchar(50) NULL / [审批时间] datetime2 NULL 两列(COL_LENGTH 守卫);
 *   §2 yj_field 登记「审批人」「审批时间」(seq 210/211;不登记 ⇒ QueryService 取不到该列,
 *      纸面「批准」格与导出报表参数都永远是空的 —— 与特采单 migrate-qc-tcin-twolevel.sql §1 同一踩坑);
 *   §3 「检验员」置 editable=0(编制格只读);审计两格(审核人/审核时间/审批人/审批时间)恒定只读;
 *   §4 5 个列的中文注明改写(检验员/审核人/审核时间/审批人/审批时间;含驳回/弃审清空口径;缺则补、有则更新);
 *   §5 译名:审批人/审批时间/审核人/审核时间 已有 10 语言、检验员 已有 9 语言(含 en)⇒
 *      只补 检验员 缺的 zh-TW;全部 NOT EXISTS 守卫,不重复插入已有译名;
 *   §6 自检(RAISERROR 16 失败):按「设计集合必须都在、被删才报错」口径
 *      (yj_field 这两行固定,可精确;列/注明/译名按集合逐项校验,不写"精确等于 N"这类日后合法新增必炸的断言)。
 *
 * 幂等:可重复执行(IF NOT EXISTS / COL_LENGTH 守卫 + 注明 add-or-update),重复执行不报错。
 * 两账套:先正式 HSDZ_MES,后测试 HSDZ_MES_TEST,各执行一遍。
 */

SET NOCOUNT ON;
GO

-- ═════════════ 1. qc_oqc_head:增加「审批人 / 审批时间」两列(COL_LENGTH 守卫) ═════════════
IF COL_LENGTH(N'dbo.qc_oqc_head', N'审批人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_oqc_head ADD [审批人] nvarchar(50) NULL;
  PRINT N'[OK] qc_oqc_head +列 审批人 nvarchar(50) NULL';
END
ELSE PRINT N'[SKIP] qc_oqc_head 列已存在:审批人';
GO
IF COL_LENGTH(N'dbo.qc_oqc_head', N'审批时间') IS NULL
BEGIN
  ALTER TABLE dbo.qc_oqc_head ADD [审批时间] datetime2 NULL;
  PRINT N'[OK] qc_oqc_head +列 审批时间 datetime2 NULL';
END
ELSE PRINT N'[SKIP] qc_oqc_head 列已存在:审批时间';
GO

-- ═════════════ 2. yj_field:审批人 / 审批时间 登记(seq 接在 审核时间=150 之后,独立号段 210/211) ═════════════
-- 纸面签署行第三格「批准」绑的就是 审批人(QcOqcSheet.vue / qc_oqc.jrxml 的 { label:'批准', key:'审批人' });
-- 没登记字段 ⇒ QueryService 的 header 取数选不出该列 ⇒ 纸面与导出报表永远空白。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'审批人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_OQC_REPORT', N'审批人', N'审批人', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 90, 0, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'审批时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_OQC_REPORT', N'审批时间', N'审批时间', N'文本', NULL, NULL, NULL, NULL, N'header', 211, 130, 0, 0, 0, 1);
GO

-- ═════════════ 3. 签名格只读(全自动落值,不接受手改) ═════════════
-- 3a 检验员 = 编制格(2026-11-04 用户口径「检验员=编制,提交审批时自动写提交人、只读」)
UPDATE yj_field SET editable = 0, required = 0
WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'检验员';
GO
-- 3b 审计两格(审核/审批)恒定只读 —— 值只由审批流写(与 migrate-qc-docs-twolevel.sql §1 同口径)
UPDATE yj_field SET editable = 0, required = 0
WHERE panel_code = N'QC_OQC_REPORT' AND col_name IN (N'审核人', N'审核时间', N'审批人', N'审批时间');
GO

-- ═════════════ 4. 5 个关键列的中文注明(旧注明缺失/过时 → 改写为两级审批口径) ═════════════
-- 口径:检验员=编制(提交人,只读);审核人/审核时间=一级审批通过的人/时间;审批人/审批时间=超级管理员(二级)批准的人/时间;
--       驳回/弃审一律清空 审核人/审核时间/审批人/审批时间(编制格不清 —— 谁编的单没变,重提时刷新)。
DECLARE @t sysname = N'qc_oqc_head';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols (col, descr) VALUES
  (N'检验员',   N'检验员:纸面(受控表单 YJ-QR-05/A1)签署行第一格=「编制」,即提交审批的人(出厂检验报告两级审批,提交时后端自动写,只读不可手改;驳回/弃审不清理,重新提交时刷新)'),
  (N'审核人',   N'审核人:纸面签署行第二格「审核」=一级审批通过的人(组织架构勾了该面板「审核反审核」的角色账号∪管理员;驳回/弃审清空)'),
  (N'审核时间', N'审核时间:一级审批通过的时间(与审核人同进同退;驳回/弃审清空)'),
  (N'审批人',   N'审批人:纸面签署行第三格「批准」=超级管理员(yj_user.is_admin=Y;二级审批通过时才落值;驳回/弃审清空)'),
  (N'审批时间', N'审批时间:超级管理员批准的时间(二级审批通过时刻;驳回/弃审清空)');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
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
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═════════════ 5. 译名(只补缺;已有译名一律不重复插入) ═════════════
-- 现状(两账套一致):审批人/审批时间/审核人/审核时间 各 10 语言(含 en);
-- 检验员 9 语言(de/en/es/fr/ja/ko/ru/th/vi,含 en)缺 zh-TW ⇒ 补 zh-TW;en 存在但保留一条守卫,
-- 使全新账套重放迁移链时也有 en(与 AGENTS.md 多语言强制规范一致)。
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  ('field', N'检验员', 'en',    N'Inspector'),
  ('field', N'检验员', 'zh-TW', N'檢驗員')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- ═════════════ 6. 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log;全 PASS 才 PRINT) ═════════════
DECLARE @bad int = 0;

-- 6a 两列存在(设计集合:审批人 / 审批时间)
IF COL_LENGTH(N'dbo.qc_oqc_head', N'审批人') IS NULL OR COL_LENGTH(N'dbo.qc_oqc_head', N'审批时间') IS NULL
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_oqc_head 缺列:审批人/审批时间 未建齐', 16, 1); END

-- 6b 两行 yj_field 存在(这两行固定,可精确)
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                  WHERE panel_code = N'QC_OQC_REPORT' AND col_name IN (N'审批人', N'审批时间'));
IF @f <> 2 BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] QC_OQC_REPORT 的 审批人/审批时间 yj_field 未登记齐(应 2,实测 %d)', 16, 1, @f); END

-- 6c 检验员 editable=0(编制格只读)
IF NOT EXISTS (SELECT 1 FROM yj_field
               WHERE panel_code = N'QC_OQC_REPORT' AND col_name = N'检验员' AND editable = 0)
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] QC_OQC_REPORT.检验员 不是只读(editable 应为 0)', 16, 1); END

-- 6d 5 条列注明存在(逐项集合校验:任一缺 ⇒ FAIL;被删才报错,不写精确等值)
DECLARE @missDesc int = (SELECT COUNT(*) FROM (VALUES (N'检验员'), (N'审核人'), (N'审核时间'), (N'审批人'), (N'审批时间')) AS v(c)
                         WHERE COL_LENGTH(N'dbo.qc_oqc_head', v.c) IS NULL
                            OR NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                                           WHERE ep.major_id = OBJECT_ID(N'dbo.qc_oqc_head')
                                             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_oqc_head'), v.c, 'ColumnId')
                                             AND ep.name = N'MS_Description' AND ep.class = 1));
IF @missDesc > 0 BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_oqc_head 有 %d 个列缺 MS_Description 中文注明(检验员/审核人/审核时间/审批人/审批时间)', 16, 1, @missDesc); END

-- 6e 5 个标签的 en 译名存在(逐项集合校验;任一缺 ⇒ FAIL)
DECLARE @missEn int = (SELECT COUNT(*) FROM (VALUES (N'检验员'), (N'审核人'), (N'审核时间'), (N'审批人'), (N'审批时间')) AS v(c)
                       WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                                         WHERE t.scope = N'field' AND t.ref_key = v.c AND t.locale = N'en'));
IF @missEn > 0 BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] yj_translation 有 %d 个字段标签缺 en 译名(检验员/审核人/审核时间/审批人/审批时间)', 16, 1, @missEn); END

IF @bad > 0
  RAISERROR(N'migrate-oqc-twolevel-20261104 自检失败(%d 项),见上方 [FAIL]', 16, 1, @bad);
ELSE
  PRINT N'migrate-oqc-twolevel-20261104 完成:出厂检验报告两级审批元数据就绪'
      + N'(qc_oqc_head +审批人/审批时间 2 列 / yj_field 2 行 + 检验员只读 / 5 条列注明 / en 译名齐)';
GO
