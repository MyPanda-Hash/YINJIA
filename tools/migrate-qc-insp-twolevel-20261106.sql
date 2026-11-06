/* migrate-qc-insp-twolevel-20261106.sql — 首件检验单(QC_FIRST_INSP)/ 制程检验单(QC_PROC_INSP)接入两级审批:
 *                                     编制(检验员) / 审核 / 批准 三格自动落值
 *
 * 任务来源(用户口径,2026-11-06):「首件检验单和制程检验单要实现审批流程」。
 * 参考实现:tools/migrate-oqc-twolevel-20261104.sql(出厂检验报告 QC_OQC_REPORT,同一套两级审批)。
 *
 * 口径(与出厂检验报告完全一致,只是编制格列名不同):
 *   ① 一级 = 审批通过(有该面板「审核反审核」权 yj_role_panel.can_approve='Y' 的角色 ∪ 管理员);
 *      二级 = **超级管理员批准**(yj_user.is_admin='Y');两级必须各点一次(同一人也两次);
 *   ② 纸面(制程检验记录表 / 首件检验记录表)表尾签署行:第一格「检验人(检验员)」= **编制**、
 *      第二格「审核人」= 一级审批人、第三格「批准」= 超级管理员(二级批准通过才落值);
 *   ③ 代码侧同批(不在本脚本):ButtonService.QC_DOC_PREPARER 增两面板→"检验员"
 *      ⇒ ADMIN_L2_PANELS / TWO_LEVEL_PANELS 由该 Map 派生,两张单自动获得两级审批全套:
 *      直审拦截、提交审批写编制、一级通过写「审核人/审核时间」、二级批准写「审批人/审批时间」、
 *      驳回/弃审清「审核」「批准」两格、save() 剥离审批格入参;
 *      ButtonService.PREPARER_EDITABLE_PANELS 增两面板 —— 「检验员」是**检验人业务值**
 *      (默认当前电脑端登录人,可手改),save 不剥离、提交审批**只在为空时**兜底写提交人;
 *      ⚠ 与 OQC 的差别:OQC 的检验员是纯落款(yj_field 置 editable=0),这两张**保持可填**,
 *      不要把 yj_field.[检验员] 置只读(否则实际检验人会被提交人覆盖)。
 *   ④ 「审核人/审核时间」两列早已存在(见 2026-09-28 体检),本脚本只补「审批人/审批时间」两列。
 *
 * 本脚本只改**元数据**:
 *   §1 qc_proc_insp_head / qc_first_insp_head 各加 [审批人] nvarchar(50) NULL / [审批时间] datetime2 NULL
 *      (COL_LENGTH 守卫,重复执行 PRINT SKIP);
 *   §2 yj_field 登记两面板的「审批人」「审批时间」:
 *      seq:QC_PROC_INSP 275/285(现有 审核人=270 / 审核时间=280,插在两者之间与末尾);
 *           QC_FIRST_INSP 220/230(现有 审核人=200 / 审核时间=210,接在其后);width 90/140;
 *      **hidden=1 是故意的**:这两格不进纸张表头(表头字段网格按 hidden 过滤),
 *      纸张表尾/导出按 head['审批人'] / $P{审批人} 显式读 —— QueryService.rowToLabels 会下发 hidden 字段
 *      (loadDocs 的 header SELECT 按 place 取列,不过滤 hidden;ReportService.headParams 把标量全量下发),
 *      故 hidden 不影响表尾与 PDF,只是不在表头铺格。
 *   §3 五列中文注明(审批人/审批时间新增;检验员/审核人/审核时间改写为两级审批口径;缺则补、有则更新);
 *   §4 译名:只对**缺失**的 locale 用 NOT EXISTS 补(两账套现有 10 语言;这里兜底 en/zh-TW,
 *      保证全新账套重放迁移链时至少满足 AGENTS.md 多语言强制规范的 en + 常见 zh-TW,不重复插入);
 *   §5 组织架构审批权**只读校验**(不改 yj_role_panel 授权):一级审批人来自角色 can_approve='Y'。
 *      ⚠ 2026-11-06 实测与任务书前提不同(已回写 Lead):
 *        正式库 HSDZ_MES:QC_PROC_INSP / QC_FIRST_INSP 各有 4 个**非 admin 角色** can_approve='Y'
 *        (1031 仓库管理 / 1033 生产 / 1039 质量审核 / 1042 测试专用角色,perms 均含 audit),且有启用账号;
 *        测试库 HSDZ_MES_TEST 是**旧快照**:只有角色 1~7,两面板 can_approve 全 N(角色 1031+ 根本不存在),
 *        ⇒ 该账套无法"实测已有",也不能由本脚本补授权(任务口径:不改 yj_role_panel)。
 *        ⇒ 校验强度按账套分档:正式账套**硬失败** RAISERROR 16(生产上一级审批没人配 = 流程走不通);
 *          测试旧快照 PRINT [WARN] 不失败(否则 DbSync 在测试账套恒 FAIL、堵死增量部署链;
 *          按 AGENTS.md 测试库陈旧处置:重建快照,不逐条补权限)。
 *          要让测试账套也硬失败:把 §5 的 @strict 改成 1。
 *   §6 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log):
 *      两表四列存在 / 四行 yj_field 存在且 editable=0 & hidden=1 & visible=1 / 权限校验通过 / 注明与译名齐。
 *
 * 幂等:可重复执行(IF NOT EXISTS / COL_LENGTH 守卫 + 注明 add-or-update),重复执行不报错。
 * 两账套:先正式 HSDZ_MES,后测试 HSDZ_MES_TEST,各执行一遍。
 */

SET NOCOUNT ON;
GO

-- ═════════════ 1. 两张头表各加「审批人 / 审批时间」两列(COL_LENGTH 守卫) ═════════════
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'审批人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_head ADD [审批人] nvarchar(50) NULL;
  PRINT N'[OK] qc_proc_insp_head +列 审批人 nvarchar(50) NULL';
END
ELSE PRINT N'[SKIP] qc_proc_insp_head 列已存在:审批人';
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'审批时间') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_head ADD [审批时间] datetime2 NULL;
  PRINT N'[OK] qc_proc_insp_head +列 审批时间 datetime2 NULL';
END
ELSE PRINT N'[SKIP] qc_proc_insp_head 列已存在:审批时间';
GO
IF COL_LENGTH(N'dbo.qc_first_insp_head', N'审批人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_first_insp_head ADD [审批人] nvarchar(50) NULL;
  PRINT N'[OK] qc_first_insp_head +列 审批人 nvarchar(50) NULL';
END
ELSE PRINT N'[SKIP] qc_first_insp_head 列已存在:审批人';
GO
IF COL_LENGTH(N'dbo.qc_first_insp_head', N'审批时间') IS NULL
BEGIN
  ALTER TABLE dbo.qc_first_insp_head ADD [审批时间] datetime2 NULL;
  PRINT N'[OK] qc_first_insp_head +列 审批时间 datetime2 NULL';
END
ELSE PRINT N'[SKIP] qc_first_insp_head 列已存在:审批时间';
GO

-- ═════════════ 2. yj_field:两面板的「审批人 / 审批时间」登记(IF NOT EXISTS 幂等) ═════════════
-- 纸面表尾第三格「批准」绑的就是 head['审批人'](面板纸张组件显式读取)——
-- 没登记字段 ⇒ QueryService 的 header 取数选不出该列 ⇒ 表尾与导出报表永远空白
-- (与 migrate-qc-tcin-twolevel.sql §1 / migrate-oqc-twolevel-20261104.sql §2 同一踩坑)。
-- hidden=1:不进纸张表头网格;visible=1:字段本身仍启用(不是下线字段)。

-- 2a QC_PROC_INSP:审批人 seq=275(在 审核人=270 与 审核时间=280 之间),审批时间 seq=285(审核时间之后)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'审批人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_PROC_INSP', N'审批人', N'审批人', N'文本', NULL, NULL, NULL, NULL, N'header', 275, 90, 0, 0, 1, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'审批时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_PROC_INSP', N'审批时间', N'审批时间', N'文本', NULL, NULL, NULL, NULL, N'header', 285, 140, 0, 0, 1, 1);
GO

-- 2b QC_FIRST_INSP:审批人 seq=220 / 审批时间 seq=230(接在 审核人=200 / 审核时间=210 之后)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'审批人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_FIRST_INSP', N'审批人', N'审批人', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 90, 0, 0, 1, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'审批时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
VALUES (N'QC_FIRST_INSP', N'审批时间', N'审批时间', N'文本', NULL, NULL, NULL, NULL, N'header', 230, 140, 0, 0, 1, 1);
GO

-- 2c 目标态归一(幂等):已有行(理论上只有本脚本重跑)也拉回「header / 文本 / 只读 / 隐藏 / 启用 / 宽度」
UPDATE yj_field SET place = N'header', data_type = N'文本', editable = 0, required = 0, hidden = 1, visible = 1, width = 90
WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'审批人';
UPDATE yj_field SET place = N'header', data_type = N'文本', editable = 0, required = 0, hidden = 1, visible = 1, width = 140
WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'审批时间';
UPDATE yj_field SET place = N'header', data_type = N'文本', editable = 0, required = 0, hidden = 1, visible = 1, width = 90
WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'审批人';
UPDATE yj_field SET place = N'header', data_type = N'文本', editable = 0, required = 0, hidden = 1, visible = 1, width = 140
WHERE panel_code = N'QC_FIRST_INSP' AND col_name = N'审批时间';
PRINT N'[OK] yj_field 四行(两面板 × 审批人/审批时间)目标态已归一:header / 文本 / editable=0 / hidden=1 / visible=1';
GO

-- ═════════════ 3. 两表五列的中文注明(审批人/审批时间新增;检验员/审核人/审核时间改写为两级口径) ═════════════
-- 口径:检验员 = 编制格(提交审批的人 / 检验人业务值,两者在为空时兜底;提交后一般=填单检验员);
--       审核人/审核时间 = 一级审批通过的人/时间;审批人/审批时间 = 超级管理员(二级)批准的人/时间;
--       驳回/弃审一律清空 审核人/审核时间/审批人/审批时间(编制格不清 —— 谁编的单没变,重提时按新提交人刷新)。
DECLARE @t sysname, @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT v.t, v.c, v.d FROM (VALUES
    (N'qc_proc_insp_head', N'检验员',
     N'检验员:纸面(制程检验记录表)表尾第一格「检验人」=「编制」,即提交审批的人;同时是检验人业务值(默认当前电脑端登录人、可手填)。制程检验单两级审批:提交审批时**仅在为空时**兜底写提交人,驳回/弃审不清(谁编的单没变,重提时刷新)'),
    (N'qc_proc_insp_head', N'审核人',
     N'审核人:纸面表尾第二格「审核」=一级审批通过的人(组织架构勾了该面板「审核反审核」的角色账号∪管理员;二级/一级任一级驳回或弃审都清空)'),
    (N'qc_proc_insp_head', N'审核时间',
     N'审核时间:一级审批通过的时间(与审核人同进同退;驳回/弃审清空)'),
    (N'qc_proc_insp_head', N'审批人',
     N'审批人:纸面表尾第三格「批准」=超级管理员(yj_user.is_admin=Y;二级审批通过时才落值;驳回/弃审清空)'),
    (N'qc_proc_insp_head', N'审批时间',
     N'审批时间:超级管理员批准的时间(二级审批通过时刻;驳回/弃审清空)'),

    (N'qc_first_insp_head', N'检验员',
     N'检验员:纸面(首件检验记录表)表尾第一格「检验人」=「编制」,即提交审批的人;同时是检验人业务值(默认当前电脑端登录人、可手填)。首件检验单两级审批:提交审批时**仅在为空时**兜底写提交人,驳回/弃审不清(谁编的单没变,重提时刷新)'),
    (N'qc_first_insp_head', N'审核人',
     N'审核人:纸面表尾第二格「审核」=一级审批通过的人(组织架构勾了该面板「审核反审核」的角色账号∪管理员;二级/一级任一级驳回或弃审都清空)'),
    (N'qc_first_insp_head', N'审核时间',
     N'审核时间:一级审批通过的时间(与审核人同进同退;驳回/弃审清空)'),
    (N'qc_first_insp_head', N'审批人',
     N'审批人:纸面表尾第三格「批准」=超级管理员(yj_user.is_admin=Y;二级审批通过时才落值;驳回/弃审清空)'),
    (N'qc_first_insp_head', N'审批时间',
     N'审批时间:超级管理员批准的时间(二级审批通过时刻;驳回/弃审清空)')
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
PRINT N'[OK] 两表共 10 条列注明已写入(审批人/审批时间新增;检验员/审核人/审核时间改写为两级口径)';
GO

-- ═════════════ 4. 译名补缺(只补缺失 locale;NOT EXISTS 守卫,绝不重复插入) ═════════════
-- 现状(2026-11-06 实测两账套):审批人/审批时间/审核人/审核时间/检验员 各 10 语言(含 en)。
-- 这里兜底 en + zh-TW:全新账套重放迁移链时也满足 AGENTS.md 多语言强制规范的 en,
-- 并补齐 OQC 脚本只补过 检验员 zh-TW 的历史缺口(其它 9 语言由 migrate-qc-tcin-twolevel.sql §4 覆盖)。
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  ('field', N'审批人',   'en',    N'Approved by (workflow)'),
  ('field', N'审批人',   'zh-TW', N'審批人'),
  ('field', N'审批时间', 'en',    N'Approved at (workflow)'),
  ('field', N'审批时间', 'zh-TW', N'審批時間'),
  ('field', N'审核人',   'en',    N'Approved by'),
  ('field', N'审核人',   'zh-TW', N'審核人'),
  ('field', N'审核时间', 'en',    N'Approved at'),
  ('field', N'审核时间', 'zh-TW', N'審核時間'),
  ('field', N'检验员',   'en',    N'Inspector'),
  ('field', N'检验员',   'zh-TW', N'檢驗員')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
PRINT N'[OK] 译名补缺完成:审批人/审批时间/审核人/审核时间/检验员 的 en + zh-TW(已存在的不重复插入)';
GO

-- ═════════════ 5. 组织架构审批权只读校验(不改 yj_role_panel 授权) ═════════════
-- 两级审批的一级 = 该面板 can_approve='Y' 的非 admin 角色账号(∪管理员)。
-- 若一个面板**没有任何非 admin 角色**可审,普通用户提交后只有管理员能批 —— 视为权限未配置。
-- ⚠ 账套分档(见文件头 §5 说明):正式账套硬失败;测试旧快照(HSDZ_MES_TEST)只 WARN,避免 DbSync 恒 FAIL。
--   两账套都硬校验:把 @strict 改成 1(测试账套须先重建/补角色授权,本脚本不动授权)。
DECLARE @strict bit = CASE WHEN DB_NAME() = N'HSDZ_MES' THEN 1 ELSE 0 END;
DECLARE @procRoles int, @firstRoles int, @missing int = 0;

SELECT @procRoles = COUNT(DISTINCT rp.role_id)
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'QC_PROC_INSP' AND rp.can_approve = 'Y'
   AND NOT EXISTS (SELECT 1 FROM yj_role r WHERE r.id = rp.role_id AND r.is_admin = 'Y');

SELECT @firstRoles = COUNT(DISTINCT rp.role_id)
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'QC_FIRST_INSP' AND rp.can_approve = 'Y'
   AND NOT EXISTS (SELECT 1 FROM yj_role r WHERE r.id = rp.role_id AND r.is_admin = 'Y');

IF @procRoles = 0  SET @missing = @missing + 1;
IF @firstRoles = 0 SET @missing = @missing + 1;

-- 5a 实际审批角色与启用账号人数(证据输出;两账套都打)
DECLARE @pc sysname, @rid int, @rname nvarchar(100), @uname nvarchar(100), @ucount int;
DECLARE curp CURSOR LOCAL FAST_FORWARD FOR
  SELECT DISTINCT rp.panel_code, r.id, r.role_name
    FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
   WHERE rp.panel_code IN (N'QC_PROC_INSP', N'QC_FIRST_INSP')
     AND rp.can_approve = 'Y' AND r.is_admin = 'N'
   ORDER BY rp.panel_code, r.id;
OPEN curp; FETCH NEXT FROM curp INTO @pc, @rid, @rname;
WHILE @@FETCH_STATUS = 0
BEGIN
  SELECT @ucount = COUNT(DISTINCT u.username), @uname = MAX(u.real_name)
    FROM yj_user u
   WHERE u.role_id = @rid AND u.is_admin = 'N'
     AND ISNULL(u.enabled, '1') = '1' AND ISNULL(u.asp_cancel, 'N') <> 'Y';
  PRINT N'[INFO] ' + @pc + N' 一级审批角色:' + @rname + N'(role_id=' + CAST(@rid AS nvarchar(10))
      + N'),启用账号 ' + CAST(@ucount AS nvarchar(10)) + N' 人'
      + CASE WHEN @ucount > 0 THEN N'(如 ' + ISNULL(@uname, N'') + N')' ELSE N'(该角色暂无启用账号)' END;
  FETCH NEXT FROM curp INTO @pc, @rid, @rname;
END
CLOSE curp; DEALLOCATE curp;
PRINT N'[INFO] 非 admin 审批角色数:QC_PROC_INSP = ' + CAST(@procRoles AS nvarchar(10))
    + N' 个,QC_FIRST_INSP = ' + CAST(@firstRoles AS nvarchar(10)) + N' 个';

IF @missing > 0
BEGIN
  IF @strict = 1
    RAISERROR(N'[FAIL] 组织架构审批权限未配置:%d 个面板没有任何非 admin 角色 can_approve=''Y''(两级审批的一级将无人可审;请在组织架构/权限矩阵给角色勾「审核反审核」,本脚本不改授权)', 16, 1, @missing);
  ELSE
    PRINT N'[WARN] 当前账套(' + DB_NAME() + N')是**旧快照**:有 ' + CAST(@missing AS nvarchar(10))
        + N' 个面板没有任何非 admin 角色 can_approve=''Y''(角色 1031+ 尚未建/未授权)。'
        + N'按 AGENTS.md「测试库陈旧」处置:重建测试快照(make-test-db.ps1)后再执行,本脚本不改 yj_role_panel 授权。';
END
ELSE
  PRINT N'[OK] 组织架构审批权校验通过:两面板均有非 admin 角色可做一级审批';
GO

-- ═════════════ 6. 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log;全 PASS 才 PRINT) ═════════════
DECLARE @bad int = 0;

-- 6a 两表四列存在(设计集合:审批人 / 审批时间)
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'审批人') IS NULL OR COL_LENGTH(N'dbo.qc_proc_insp_head', N'审批时间') IS NULL
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_proc_insp_head 缺列:审批人/审批时间 未建齐', 16, 1); END
IF COL_LENGTH(N'dbo.qc_first_insp_head', N'审批人') IS NULL OR COL_LENGTH(N'dbo.qc_first_insp_head', N'审批时间') IS NULL
BEGIN SET @bad = @bad + 1; RAISERROR(N'[FAIL] qc_first_insp_head 缺列:审批人/审批时间 未建齐', 16, 1); END

-- 6b 四行 yj_field 存在且 editable=0 / hidden=1 / visible=1(四行固定,可精确)
DECLARE @f int = (SELECT COUNT(*) FROM yj_field
                  WHERE ((panel_code = N'QC_PROC_INSP' AND col_name IN (N'审批人', N'审批时间'))
                      OR (panel_code = N'QC_FIRST_INSP' AND col_name IN (N'审批人', N'审批时间')))
                    AND editable = 0 AND hidden = 1 AND visible = 1);
IF @f <> 4
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] 两面板 审批人/审批时间 yj_field 应 4 行且 editable=0 & hidden=1 & visible=1,实测符合 %d 行', 16, 1, @f);
END

-- 6c 组织架构审批权:正式账套必须通过(测试旧快照按文件头 §5 的账套分档只告警)
DECLARE @strict2 bit = CASE WHEN DB_NAME() = N'HSDZ_MES' THEN 1 ELSE 0 END;
DECLARE @roles2 int = (SELECT COUNT(DISTINCT rp.role_id)
                       FROM yj_role_panel rp
                       WHERE rp.panel_code IN (N'QC_PROC_INSP', N'QC_FIRST_INSP') AND rp.can_approve = 'Y'
                         AND NOT EXISTS (SELECT 1 FROM yj_role r WHERE r.id = rp.role_id AND r.is_admin = 'Y'));
IF @strict2 = 1 AND @roles2 = 0
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] 组织架构审批权限未配置:两面板没有任何非 admin 角色 can_approve=''Y''', 16, 1);
END
IF @strict2 = 0 AND @roles2 = 0
  PRINT N'[WARN] 测试旧快照两面板无非 admin 审批角色(已在 §5 说明;正式账套须通过)';

-- 6d 10 条列注明存在(逐项集合校验;被删才报错,不写精确等值)
DECLARE @missDesc int = (SELECT COUNT(*) FROM (VALUES
    (N'qc_proc_insp_head', N'检验员'), (N'qc_proc_insp_head', N'审核人'), (N'qc_proc_insp_head', N'审核时间'),
    (N'qc_proc_insp_head', N'审批人'), (N'qc_proc_insp_head', N'审批时间'),
    (N'qc_first_insp_head', N'检验员'), (N'qc_first_insp_head', N'审核人'), (N'qc_first_insp_head', N'审核时间'),
    (N'qc_first_insp_head', N'审批人'), (N'qc_first_insp_head', N'审批时间')
  ) AS v(t, c)
  WHERE COL_LENGTH(v.t, v.c) IS NULL
     OR NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = OBJECT_ID(v.t)
                      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(v.t), v.c, 'ColumnId')
                      AND ep.name = N'MS_Description' AND ep.class = 1));
IF @missDesc > 0
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] 两表有 %d 个列缺 MS_Description 中文注明(检验员/审核人/审核时间/审批人/审批时间)', 16, 1, @missDesc);
END

-- 6e 5 个标签的 en 译名存在(逐项集合校验;任一缺 ⇒ FAIL)
DECLARE @missEn int = (SELECT COUNT(*) FROM (VALUES (N'检验员'), (N'审核人'), (N'审核时间'), (N'审批人'), (N'审批时间')) AS v(c)
                       WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                                         WHERE t.scope = N'field' AND t.ref_key = v.c AND t.locale = N'en'));
IF @missEn > 0
BEGIN
  SET @bad = @bad + 1;
  RAISERROR(N'[FAIL] yj_translation 有 %d 个字段标签缺 en 译名(检验员/审核人/审核时间/审批人/审批时间)', 16, 1, @missEn);
END

IF @bad > 0
  RAISERROR(N'migrate-qc-insp-twolevel-20261106 自检失败(%d 项),见上方 [FAIL]', 16, 1, @bad);
ELSE
  PRINT N'migrate-qc-insp-twolevel-20261106 完成:首件/制程检验单两级审批元数据就绪'
      + N'(两表 +审批人/审批时间 共 4 列 / yj_field 4 行[editable=0,hidden=1] / 10 条列注明 / en+zh-TW 译名齐 / 审批权校验通过)';
GO
