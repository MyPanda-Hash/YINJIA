/* migrate-qc-asm-insp-batch-table-20261112.sql(2026-11-12)
 *
 * 出货检验表观(QC_ASM_INSP,原「组装成品检验单」)接《出货检验功能记录表》YJ-QR-154 图2 表样 —— 落库与元数据。
 * 设计契约:docs/design/出货检验功能记录表-表样改造.md(§二 数据模型 / §二 字段清单 / §三 前端表样)。
 * 写法与上一轮「出货检验单功能 QC_PROC_INSP」那条**逐节对齐**:
 *   tools/migrate-qc-proc-insp-batch-table-20261111.sql
 *   本脚本 = 把该脚本里的对象从 qc_proc_insp_* / QC_PROC_INSP 换成 qc_asm_insp_* / QC_ASM_INSP,
 *   并去掉其中的「面板改名」「面板译名」两节(那两节 2026-11-11 已经做过,本脚本只核对、不重做)。
 *
 * 用户口径(2026-11-12,承接 2026-11-11 第 1 条「将当前的组装成品检验修改为出货检验表观」):
 *   「组装成品检验(显示名已改出货检验表观)也要按图2 那张纸显示,明细同样按批次矩阵填写」
 *   —— 表观单与功能单是**同一张纸**:明细「一行 = 检验项目 × 内部批次」,每批两列(批次号 + 结果判断)。
 *
 * 落点(照抄功能单;为什么摊在明细表不新建子表,见设计文档 §二):
 *   1. qc_asm_insp_detail + 列 [内部批次] nvarchar(60) NULL —— 一行 = (检验项目 × 内部批次);
 *   2. qc_asm_insp_head   + 列 [内部批次清单] nvarchar(500) NULL —— 批次列顺序(英文逗号分隔),
 *      保证「先加批次、后带入检验项目」也能记住列(行上没数据时列不丢);
 *   3. qc_asm_insp_head   + 列 [表单审核人] nvarchar(50) NULL —— 纸面表尾「审核人」(默认冯敏、可改;
 *      审批流写入的虚拟「审核人」不动,两栏各管一栏);
 *   4. yj_field 登记 3 行(明细 内部批次:可编辑可见;表头 内部批次清单 / 表单审核人:隐藏但可保存);
 *   5. 总结论 改「下拉框」合格/不合格;处理方式 改「下拉框」允收/合格/不合格/报废
 *      (dict_sql 与功能单 migrate-qc-proc-insp-batch-table-20261111.sql 第 4 节**逐字同款**);
 *   6. 字段译名(scope='field')4 个标签 × 10 语种 —— 2026-11-11 那条已按「同一中文标签全局共享译名」
 *      插过,本脚本 NOT EXISTS 后实际 0 行;留着是为了「新库单跑本脚本」也自足,自检按「各 ≥10 语种」卡。
 *
 * 不改(刻意):
 *   · 面板代号 QC_ASM_INSP / 物理表 qc_asm_insp_* / 单号前缀 ZJ / 历史数据 / 审批状态;
 *   · 面板显示名与面板译名 —— 2026-11-11 的 migrate-qc-proc-insp-batch-table-20261111.sql 已把
 *     yj_panel.QC_ASM_INSP 改成「出货检验表观」+ 10 语种译名,本脚本只**核对**它还在(§0 闸门 + §6 自检);
 *   · 处理方式 的 place / hidden / visible 一律不动,只改 data_type + dict_sql。
 *     ⚠ 与功能单的差异:功能单那列 hidden=1,表观单这列当前 hidden=0/visible=1(既存状态,不在本脚本收口);
 *       存量值里有 19 行「合格转库存(FI-…)」这类旧自由文本,下拉选项不含它们 —— 数据原样保留,只影响下拉候选;
 *   · 「检测周期」是**后端派生只读**列(首次保存 ~ 末次提交/审核,QueryService 下发),
 *     **不建 yj_field 行**(建了会触发体检 05 元数据漂移;§6 自检里卡死这一点);
 *   · 明细「实测数值」:表观单历史数据在「检验结果」列,纸面组件的 resultTextField 由挂载方指定为 检验结果,
 *     故本脚本**不**给 QC_ASM_INSP 补 实测数值 字段行(补了会与 检验结果 双列并存);
 *   · yj_menu_node / 前端文案 / 菜单标题(在 frontend/src/business/menus.js)不在本脚本范围。
 *
 * 幂等:列用 COL_LENGTH 判空再 ADD;注明 sp_addextendedproperty / sp_updateextendedproperty 两分支;
 *   yj_field / yj_translation 一律 NOT EXISTS 再 INSERT,配置已达标时不产生 UPDATE;
 *   重复执行 = 0 行变更、自检照旧 PASS。
 * 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),执行方式:
 *   cd tools && YINJIA_SQL_DB=HSDZ_MES      "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql
 *   cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-asm-insp-batch-table-20261112.sql
 */

SET NOCOUNT ON;
GO

/* ═════════════ 0. 前置闸门:两张物理表 + 面板行 + 面板改名必须已在 ═════════════ */
IF OBJECT_ID(N'dbo.qc_asm_insp_head', N'U') IS NULL
   OR OBJECT_ID(N'dbo.qc_asm_insp_detail', N'U') IS NULL
  RAISERROR(N'[FAIL] 缺 qc_asm_insp_head / qc_asm_insp_detail,本脚本无法继续', 16, 1);
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'QC_ASM_INSP') <> 1
  RAISERROR(N'[FAIL] yj_panel 缺 QC_ASM_INSP 行(应为 1 行),本脚本无法继续', 16, 1);
/* 表观单的显示名是上一轮脚本(2026-11-11)改的,本脚本不改名 ⇒ 名字不对说明链序不对;
 * 早退比「先加列插字段、最后自检才失败」干净(DDL 按 GO 批自动提交,中途失败会留半成品)。 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP' AND panel_name = N'出货检验表观')
  RAISERROR(N'[FAIL] QC_ASM_INSP 显示名不是「出货检验表观」:请先执行 migrate-qc-proc-insp-batch-table-20261111.sql(改名在那边)', 16, 1);
PRINT N'[OK] 前置闸门:qc_asm_insp_head/detail、yj_panel.QC_ASM_INSP(出货检验表观)全在';
GO

/* ═════════════ 1. 加列(明细 内部批次;表头 内部批次清单 / 表单审核人) ═════════════ */
PRINT N'== 1. 加列 ==';
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'内部批次') IS NULL
BEGIN
  ALTER TABLE dbo.qc_asm_insp_detail ADD 内部批次 nvarchar(60) NULL;
  PRINT N'  [ADD] qc_asm_insp_detail.内部批次 nvarchar(60) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_asm_insp_detail.内部批次 已存在';

IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'内部批次清单') IS NULL
BEGIN
  ALTER TABLE dbo.qc_asm_insp_head ADD 内部批次清单 nvarchar(500) NULL;
  PRINT N'  [ADD] qc_asm_insp_head.内部批次清单 nvarchar(500) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_asm_insp_head.内部批次清单 已存在';

IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'表单审核人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_asm_insp_head ADD 表单审核人 nvarchar(50) NULL;
  PRINT N'  [ADD] qc_asm_insp_head.表单审核人 nvarchar(50) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_asm_insp_head.表单审核人 已存在';
GO

/* ═════════════ 2. 列级中文注明(MS_Description;有则改、无则加) ═════════════ */
PRINT N'== 2. 列级中文注明 ==';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'内部批次', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'该明细行所属的内部生产批次(表观单同款矩阵:一行 = 检验项目 × 内部批次;同一检验项目有几个批次就有几行,检验要求/检验方法各存一份并由界面写穿同步)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'内部批次';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'该明细行所属的内部生产批次(表观单同款矩阵:一行 = 检验项目 × 内部批次;同一检验项目有几个批次就有几行,检验要求/检验方法各存一份并由界面写穿同步)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_detail', N'COLUMN', N'内部批次';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'内部批次清单', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'内部生产批次列的顺序清单(英文逗号分隔,如 261105,261107,261108);行上没有数据时靠它保住批次列不丢',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'内部批次清单';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'内部生产批次列的顺序清单(英文逗号分隔,如 261105,261107,261108);行上没有数据时靠它保住批次列不丢',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'内部批次清单';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'表单审核人', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'纸面表尾「审核人」栏(默认冯敏、可手工修改;与审批流写入的虚拟「审核人」/「审批人」各管一栏,互不覆盖)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'表单审核人';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'纸面表尾「审核人」栏(默认冯敏、可手工修改;与审批流写入的虚拟「审核人」/「审批人」各管一栏,互不覆盖)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'表单审核人';
PRINT N'  [OK] 3 列中文注明已就位';
GO

/* ═════════════ 3. yj_field 登记 ═════════════ */
PRINT N'== 3. yj_field 登记 ==';

/* 3.1 明细「内部批次」:必须在明细字段集合里(place 含 detail),通用保存/加载/纸面矩阵才会带它。
 *     seq = 该面板 detail 侧现有最大值 + 10。执行时:
 *       最大 seq = 900(「行号」,hidden=1 的内部列),⇒ 910;
 *       可见明细列的最大 seq 是 结果判断(210) ⇒ 910 让新列排在**所有明细列之后**,不打乱任何既有顺序。
 *     (写法与功能单同款:取「place 含 detail」的最大值,含 hidden 的内部列,免得以后它们撞号。) */
DECLARE @seqDetail int = (SELECT ISNULL(MAX(seq), 0) + 10
                            FROM yj_field
                           WHERE panel_code = N'QC_ASM_INSP'
                             AND place LIKE N'%detail%'
                             AND col_name <> N'内部批次');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'内部批次', N'内部批次', N'文本', N'detail', @seqDetail, 110, 1, 0, 0, 1);
  PRINT N'  [INSERT] QC_ASM_INSP.内部批次(place=detail,seq=' + CAST(@seqDetail AS nvarchar(10)) + N',可编辑可见)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'detail', width = 110,
         editable = 1, required = 0, hidden = 0, visible = 1
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'detail' OR ISNULL(width, 0) <> 110
          OR editable <> 1 OR required <> 0 OR hidden <> 0 OR visible <> 1);
  PRINT N'  [SYNC] QC_ASM_INSP.内部批次 属性已对齐(重跑 0 行)';
END

/* 3.2 表头「内部批次清单」:隐藏但可保存(hidden=1 / visible=0),seq 295(表观单 header 侧现有最大 seq 是
 *     210 审核时间,295 不与任何可见表头字段争序;隐藏字段不参与表单渲染/表头网格)。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次清单')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'内部批次清单', N'内部批次清单', N'文本', N'header', 295, 200, 1, 0, 1, 0);
  PRINT N'  [INSERT] QC_ASM_INSP.内部批次清单(place=header,seq=295,hidden=1 仅存取)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'header', seq = 295, width = 200,
         editable = 1, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次清单'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'header' OR ISNULL(seq, 0) <> 295
          OR ISNULL(width, 0) <> 200 OR editable <> 1 OR required <> 0 OR hidden <> 1 OR visible <> 0);
  PRINT N'  [SYNC] QC_ASM_INSP.内部批次清单 属性已对齐(重跑 0 行)';
END

/* 3.3 表头「表单审核人」:同上,seq 296。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'表单审核人')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'表单审核人', N'表单审核人', N'文本', N'header', 296, 90, 1, 0, 1, 0);
  PRINT N'  [INSERT] QC_ASM_INSP.表单审核人(place=header,seq=296,hidden=1 仅存取)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'header', seq = 296, width = 90,
         editable = 1, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'表单审核人'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'header' OR ISNULL(seq, 0) <> 296
          OR ISNULL(width, 0) <> 90 OR editable <> 1 OR required <> 0 OR hidden <> 1 OR visible <> 0);
  PRINT N'  [SYNC] QC_ASM_INSP.表单审核人 属性已对齐(重跑 0 行)';
END
GO

/* ═════════════ 4. 两个字段改「下拉框」(与功能单逐字同款) ═════════════ */
PRINT N'== 4. 下拉框改造 ==';

/* 4.1 总结论(纸面「检验结论」):合格 / 不合格 —— dict_sql 与功能单(QC_PROC_INSP)一字不差。
 *     只改 data_type + dict_sql(place=query,header 与 editable 不动)。 */
DECLARE @dictConclusion nvarchar(500) =
        N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)';
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'总结论') <> 1
  RAISERROR(N'[FAIL] QC_ASM_INSP.总结论 登记行数不为 1,无法改下拉框', 16, 1);
UPDATE yj_field
   SET data_type = N'下拉框', dict_sql = @dictConclusion
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'总结论'
   AND (ISNULL(data_type, N'') <> N'下拉框' OR ISNULL(dict_sql, N'') <> @dictConclusion);
PRINT N'  [OK] 总结论 → 下拉框(合格/不合格)';

/* 4.2 处理方式(纸面「处理意见」):允收 / 合格 / 不合格 / 报废;dict_sql 与功能单同款。
 *     ⚠ 本单这列当前 hidden=0/visible=1(功能单是 hidden=1),本脚本**不动** place/hidden/visible ——
 *       只改下拉属性;存量旧自由文本(如「合格转库存(FI-…)」)原样保留在库里,不进候选而已。 */
DECLARE @dictDisposal nvarchar(500) =
        N'SELECT v FROM (VALUES (N''允收''),(N''合格''),(N''不合格''),(N''报废'')) AS t(v)';
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'处理方式') <> 1
  RAISERROR(N'[FAIL] QC_ASM_INSP.处理方式 登记行数不为 1,无法改下拉框', 16, 1);
UPDATE yj_field
   SET data_type = N'下拉框', dict_sql = @dictDisposal
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'处理方式'
   AND (ISNULL(data_type, N'') <> N'下拉框' OR ISNULL(dict_sql, N'') <> @dictDisposal);
PRINT N'  [OK] 处理方式 → 下拉框(允收/合格/不合格/报废;place/hidden 未动)';
GO

/* ═════════════ 5. 字段译名(scope='field',10 语种;已有全局译名就跳过) ═════════════
 * 规范(AGENTS.md 多语言强制):新增字段必须同时有译名。同一中文标签全局共享译名 ⇒
 * 用 (scope, ref_key, locale) 唯一性守卫,不重复插;文本与 migrate-qc-proc-insp-batch-table-20261111.sql
 * 第 5 节**逐字一致**(那边已插过 ⇒ 本脚本实际 0 行,只在新库/单跑时补)。 */
PRINT N'== 5. 字段译名(scope=field)==';
DECLARE @tf TABLE (ref_key nvarchar(120), locale varchar(10), text nvarchar(200));
INSERT INTO @tf (ref_key, locale, text) VALUES
  (N'内部批次', 'en', N'Internal Batch'),
  (N'内部批次', 'ja', N'内部ロット'),
  (N'内部批次', 'ko', N'내부 배치'),
  (N'内部批次', 'de', N'Interne Charge'),
  (N'内部批次', 'es', N'Lote interno'),
  (N'内部批次', 'fr', N'Lot interne'),
  (N'内部批次', 'ru', N'Внутренняя партия'),
  (N'内部批次', 'vi', N'Lô nội bộ'),
  (N'内部批次', 'th', N'ล็อตภายใน'),
  (N'内部批次', 'zh-TW', N'內部批次'),
  (N'内部批次清单', 'en', N'Batch List'),
  (N'内部批次清单', 'ja', N'ロット一覧'),
  (N'内部批次清单', 'ko', N'배치 목록'),
  (N'内部批次清单', 'de', N'Chargenliste'),
  (N'内部批次清单', 'es', N'Lista de lotes'),
  (N'内部批次清单', 'fr', N'Liste des lots'),
  (N'内部批次清单', 'ru', N'Список партий'),
  (N'内部批次清单', 'vi', N'Danh sách lô'),
  (N'内部批次清单', 'th', N'รายการล็อต'),
  (N'内部批次清单', 'zh-TW', N'內部批次清單'),
  (N'表单审核人', 'en', N'Form Reviewer'),
  (N'表单审核人', 'ja', N'書面審査者'),
  (N'表单审核人', 'ko', N'서면 검토자'),
  (N'表单审核人', 'de', N'Formularprüfer'),
  (N'表单审核人', 'es', N'Revisor del formulario'),
  (N'表单审核人', 'fr', N'Vérificateur du formulaire'),
  (N'表单审核人', 'ru', N'Проверяющий форму'),
  (N'表单审核人', 'vi', N'Người duyệt biểu mẫu'),
  (N'表单审核人', 'th', N'ผู้ตรวจสอบแบบฟอร์ม'),
  (N'表单审核人', 'zh-TW', N'表單審核人'),
  (N'检测周期', 'en', N'Inspection Period'),
  (N'检测周期', 'ja', N'検査期間'),
  (N'检测周期', 'ko', N'검사 주기'),
  (N'检测周期', 'de', N'Prüfzeitraum'),
  (N'检测周期', 'es', N'Período de inspección'),
  (N'检测周期', 'fr', N'Période d''inspection'),
  (N'检测周期', 'ru', N'Период проверки'),
  (N'检测周期', 'vi', N'Chu kỳ kiểm tra'),
  (N'检测周期', 'th', N'ระยะเวลาตรวจสอบ'),
  (N'检测周期', 'zh-TW', N'檢測週期');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.ref_key, t.locale, t.text, N'manual'
  FROM @tf t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'  [OK] 4 个字段标签 × 10 语种(缺的补,已有的不动)';
GO

/* ═════════════ 6. 自检(不符即 RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log) ═════════════ */
PRINT N'== 6. 自检 ==';
DECLARE @bad int = 0;

/* 6.1 物理列(3 列;内部批次 明细 / 内部批次清单·表单审核人 表头) */
IF COL_LENGTH(N'dbo.qc_asm_insp_detail', N'内部批次') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'内部批次清单') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'表单审核人') IS NULL SET @bad = @bad + 1;

/* 6.2 列级中文注明(3 列都有) */
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_detail'), N'内部批次', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'内部批次清单', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'表单审核人', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;

/* 6.3 yj_field 三行:登记数各 1、可见性/可编辑性达标 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次'
                AND place LIKE N'%detail%' AND hidden = 0 AND visible = 1 AND editable = 1 AND required = 0
                AND ISNULL(seq, 0) > 0) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次清单') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'内部批次清单'
                AND place = N'header' AND hidden = 1 AND visible = 0 AND editable = 1) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'表单审核人') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'表单审核人'
                AND place = N'header' AND hidden = 1 AND visible = 0 AND editable = 1) SET @bad = @bad + 1;

/* 6.4 seq 不撞号:
 *   (a) 明细侧:place 含 detail 的行的 seq 必须两两不同(同 seq 只能靠 id 兜底排序 = 列序不稳);
 *   (b) 表头侧**不做全局唯一**(该面板本来就有双挂字段与纯表头字段同 seq:处理方式 90 = 规格型号 90、
 *       备注 110 = 生产车间 110,既存状态),只卡「两个新隐藏字段用的 295/296 没被别的字段占」。
 *       —— 这是本脚本的 seq 300 以下、且 header 侧现最大 210,故 295/296 一定空闲。 */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%detail%'
             GROUP BY seq HAVING COUNT(*) > 1) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP'
             AND col_name NOT IN (N'内部批次清单', N'表单审核人') AND seq IN (295, 296)) SET @bad = @bad + 1;

/* 6.5 下拉框:总结论 合格/不合格;处理方式 允收/合格/不合格/报废,且 place 未被改动(仍是 header,detail) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'总结论'
                AND data_type = N'下拉框' AND dict_sql LIKE N'%合格%' AND dict_sql LIKE N'%不合格%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'处理方式'
                AND data_type = N'下拉框' AND dict_sql LIKE N'%允收%'
                AND dict_sql LIKE N'%报废%' AND dict_sql LIKE N'%不合格%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'处理方式'
                AND place = N'header,detail') SET @bad = @bad + 1;

/* 6.6 译名:4 个字段标签 en 在且各 ≥10 语种 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次清单' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'表单审核人' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检测周期' AND locale = 'en') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次清单') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'表单审核人') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'检测周期') < 10 SET @bad = @bad + 1;

/* 6.7 面板:显示名仍是「出货检验表观」(本脚本不改名)、代号/底表/单号前缀 ZJ 一个都没动 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP' AND panel_name = N'出货检验表观') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                AND panel_name_en = N'Outgoing Inspection Sheet (Appearance)') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                AND line_table = N'qc_asm_insp_detail' AND head_table = N'qc_asm_insp_head' AND prefix = 'ZJ') SET @bad = @bad + 1;

/* 6.8 派生列「检测周期」不进元数据(建了会触发体检 05 元数据漂移) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'检测周期') SET @bad = @bad + 1;

/* 6.9 明细「实测数值」不重复登记(表观单历史数据在 检验结果 列;纸面组件按 resultTextField 取) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'实测数值') SET @bad = @bad + 1;

IF @bad > 0
  RAISERROR(N'出货检验表观(批次矩阵)迁移自检失败:见脚本第 6 节各项', 16, 1);
ELSE
  PRINT N'[OK] 自检全部通过:3 新列 + 3 条注明 + 3 行 yj_field + 2 个下拉框 + 10 语种译名 + 面板名/代号/底表/前缀 ZJ 未动';
GO
