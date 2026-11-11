/* migrate-qc-proc-insp-batch-table-20261111.sql(2026-11-11)
 *
 * 出货检验功能记录表(YJ-QR-154)表样改造 —— 落库与元数据。
 * 设计契约:docs/design/出货检验功能记录表-表样改造.md
 *   §二 数据模型 / §二 字段清单(新增与修改)/ §五 改名清单。
 *
 * 用户口径(2026-11-11):
 *   1.「将当前的组装成品检验修改为出货检验表观」(只改显示名:面板代号 / 物理表 / 单号前缀 ZJ /
 *      历史数据 / 审批状态全部不动);
 *   2.「将当前的出货检验列表的格式修改为图2所示的形式。表格内的信息填写按照图中各个表格形式进行」
 *      —— 图2《出货检验功能记录表》检验明细是「一行一个检验项目 × 多个内部生产批次(每批两列:
 *      批次号 + 结果判断)」的矩阵。
 *
 * 落点(批次行摊在明细表里,不新建子表 —— 理由见设计文档 §二):
 *   1. qc_proc_insp_detail + 列 [内部批次] nvarchar(60) NULL  —— 一行 = (检验项目 × 内部批次);
 *   2. qc_proc_insp_head   + 列 [内部批次清单] nvarchar(500) NULL —— 批次列顺序(英文逗号分隔),
 *      保证「先加批次、后带入检验项目」也能记住列(行上没数据时列不丢);
 *   3. qc_proc_insp_head   + 列 [表单审核人] nvarchar(50) NULL —— 纸面审核人(默认冯敏、可改;
 *      审批流写的虚拟「审核人」不动);
 *   4. yj_field 登记 3 行(明细 内部批次:可编辑可见;表头 内部批次清单 / 表单审核人:隐藏但可保存)
 *      + 译名(scope=field,10 语种);
 *   5. 总结论 改「下拉框」合格/不合格(与明细「结果判断」同款写法);
 *      处理方式 改「下拉框」允收/合格/不合格/报废(hidden 保持 1,不放开显示);
 *   6. 改名:QC_ASM_INSP 面板显示名 组装成品检验单 → 出货检验表观 + 新面板键 10 语种译名;
 *      旧键「组装成品检验单」的译名**保留不删**(历史引用兜底)。
 *
 * 不改(刻意):
 *   · 面板代号 QC_ASM_INSP / QC_PROC_INSP、物理表、单号前缀(ZJ / ZC)、历史数据、审批状态;
 *   · 「检测周期」是**后端派生只读**列(首次保存 ~ 末次提交/审核,QueryService 下发),
 *     **不建 yj_field 行**(建了会触发体检 05 元数据漂移;自检里卡死这一点);
 *   · 处理方式 的 place / hidden / visible 一律不动(只改 data_type + dict_sql);
 *   · yj_menu_node 无 QC_ASM_INSP 的菜单名覆盖行(两账套实测 0 行),菜单标题在 frontend/menus.js,
 *     不在本脚本范围。
 *
 * 幂等:列用 COL_LENGTH 判空再 ADD;注明 sp_addextendedproperty/sp_updateextendedproperty 两分支;
 *   yj_field / yj_translation 一律 NOT EXISTS 再 INSERT,配置已达标时不产生 UPDATE;
 *   重复执行 = 0 行变更、自检照旧 PASS。
 * 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),执行方式:
 *   cd tools && YINJIA_SQL_DB=HSDZ_MES  "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-batch-table-20261111.sql
 *   cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-proc-insp-batch-table-20261111.sql
 */

SET NOCOUNT ON;
GO

/* ═════════════ 0. 前置闸门:两张物理表与面板行必须在 ═════════════ */
IF OBJECT_ID(N'dbo.qc_proc_insp_head', N'U') IS NULL
   OR OBJECT_ID(N'dbo.qc_proc_insp_detail', N'U') IS NULL
  RAISERROR(N'[FAIL] 缺 qc_proc_insp_head / qc_proc_insp_detail,本脚本无法继续', 16, 1);
IF OBJECT_ID(N'dbo.qc_asm_insp_head', N'U') IS NULL
  RAISERROR(N'[FAIL] 缺 qc_asm_insp_head(改名对象面板的底表),本脚本无法继续', 16, 1);
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'QC_ASM_INSP') <> 1
  RAISERROR(N'[FAIL] yj_panel 缺 QC_ASM_INSP 行(应为 1 行),改名无法进行', 16, 1);
PRINT N'[OK] 前置闸门:qc_proc_insp_head/detail、qc_asm_insp_head、yj_panel.QC_ASM_INSP 全在';
GO

/* ═════════════ 1. 加列(明细 内部批次;表头 内部批次清单 / 表单审核人) ═════════════ */
PRINT N'== 1. 加列 ==';
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'内部批次') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_detail ADD 内部批次 nvarchar(60) NULL;
  PRINT N'  [ADD] qc_proc_insp_detail.内部批次 nvarchar(60) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_proc_insp_detail.内部批次 已存在';

IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'内部批次清单') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_head ADD 内部批次清单 nvarchar(500) NULL;
  PRINT N'  [ADD] qc_proc_insp_head.内部批次清单 nvarchar(500) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_proc_insp_head.内部批次清单 已存在';

IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'表单审核人') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_head ADD 表单审核人 nvarchar(50) NULL;
  PRINT N'  [ADD] qc_proc_insp_head.表单审核人 nvarchar(50) NULL';
END
ELSE
  PRINT N'  [SKIP] qc_proc_insp_head.表单审核人 已存在';
GO

/* ═════════════ 2. 列级中文注明(MS_Description;有则改、无则加) ═════════════ */
PRINT N'== 2. 列级中文注明 ==';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'内部批次', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'该明细行所属的内部生产批次(一行 = 检验项目 × 内部批次;同一检验项目有几个批次就有几行,检验要求/检验方法各存一份并由界面写穿同步)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'内部批次';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'该明细行所属的内部生产批次(一行 = 检验项目 × 内部批次;同一检验项目有几个批次就有几行,检验要求/检验方法各存一份并由界面写穿同步)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'内部批次';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'内部批次清单', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'内部生产批次列的顺序清单(英文逗号分隔,如 261105,261107,261108);行上没有数据时靠它保住批次列不丢',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head', N'COLUMN', N'内部批次清单';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'内部生产批次列的顺序清单(英文逗号分隔,如 261105,261107,261108);行上没有数据时靠它保住批次列不丢',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head', N'COLUMN', N'内部批次清单';

IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'表单审核人', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'纸面表尾「审核人」栏(默认冯敏、可手工修改;与审批流写入的虚拟「审核人」/「审批人」各管一栏,互不覆盖)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head', N'COLUMN', N'表单审核人';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'纸面表尾「审核人」栏(默认冯敏、可手工修改;与审批流写入的虚拟「审核人」/「审批人」各管一栏,互不覆盖)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head', N'COLUMN', N'表单审核人';
PRINT N'  [OK] 3 列中文注明已就位';
GO

/* ═════════════ 3. yj_field 登记 ═════════════ */
PRINT N'== 3. yj_field 登记 ==';

/* 3.1 明细「内部批次」:必须在明细字段集合里(place 含 detail),通用保存/加载才会带它。
 *     seq = 该面板 detail 侧现有最大值 + 10(执行时为 备注(250) + 10 = 260;
 *     纯 detail 行最大是 备注2(125),但 处理方式(240)/备注(250) 是 header,detail 双挂,
 *     同样参与明细列排序 ⇒ 取「place 含 detail」的最大值,确保新列排在最后,不打乱任何既有顺序)。 */
DECLARE @seqDetail int = (SELECT ISNULL(MAX(seq), 0) + 10
                            FROM yj_field
                           WHERE panel_code = N'QC_PROC_INSP'
                             AND place LIKE N'%detail%'
                             AND col_name <> N'内部批次');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'内部批次', N'内部批次', N'文本', N'detail', @seqDetail, 110, 1, 0, 0, 1);
  PRINT N'  [INSERT] QC_PROC_INSP.内部批次(place=detail,seq=' + CAST(@seqDetail AS nvarchar(10)) + N',可编辑可见)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'detail', width = 110,
         editable = 1, required = 0, hidden = 0, visible = 1
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'detail' OR ISNULL(width, 0) <> 110
          OR editable <> 1 OR required <> 0 OR hidden <> 0 OR visible <> 1);
  PRINT N'  [SYNC] QC_PROC_INSP.内部批次 属性已对齐(重跑 0 行)';
END

/* 3.2 表头「内部批次清单」:隐藏但可保存(hidden=1 / visible=0),seq 295(在 列数 290 之后,
 *     不与任何可见表头字段争序;隐藏字段不参与表单渲染)。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次清单')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'内部批次清单', N'内部批次清单', N'文本', N'header', 295, 200, 1, 0, 1, 0);
  PRINT N'  [INSERT] QC_PROC_INSP.内部批次清单(place=header,seq=295,hidden=1 仅存取)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'header', seq = 295, width = 200,
         editable = 1, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次清单'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'header' OR ISNULL(seq, 0) <> 295
          OR ISNULL(width, 0) <> 200 OR editable <> 1 OR required <> 0 OR hidden <> 1 OR visible <> 0);
  PRINT N'  [SYNC] QC_PROC_INSP.内部批次清单 属性已对齐(重跑 0 行)';
END

/* 3.3 表头「表单审核人」:同上,seq 296。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表单审核人')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'表单审核人', N'表单审核人', N'文本', N'header', 296, 90, 1, 0, 1, 0);
  PRINT N'  [INSERT] QC_PROC_INSP.表单审核人(place=header,seq=296,hidden=1 仅存取)';
END
ELSE
BEGIN
  UPDATE yj_field
     SET data_type = N'文本', place = N'header', seq = 296, width = 90,
         editable = 1, required = 0, hidden = 1, visible = 0
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表单审核人'
     AND (ISNULL(data_type, N'') <> N'文本' OR place <> N'header' OR ISNULL(seq, 0) <> 296
          OR ISNULL(width, 0) <> 90 OR editable <> 1 OR required <> 0 OR hidden <> 1 OR visible <> 0);
  PRINT N'  [SYNC] QC_PROC_INSP.表单审核人 属性已对齐(重跑 0 行)';
END
GO

/* ═════════════ 4. 两个字段改「下拉框」 ═════════════ */
PRINT N'== 4. 下拉框改造 ==';

/* 4.1 总结论(纸面「检验结论」):合格 / 不合格 —— 与明细「结果判断」同款 VALUES 写法。
 *     只改 data_type + dict_sql(place/query,header 与 editable 不动)。 */
DECLARE @dictConclusion nvarchar(500) =
        N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)';
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'总结论') <> 1
  RAISERROR(N'[FAIL] QC_PROC_INSP.总结论 登记行数不为 1,无法改下拉框', 16, 1);
UPDATE yj_field
   SET data_type = N'下拉框', dict_sql = @dictConclusion
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'总结论'
   AND (ISNULL(data_type, N'') <> N'下拉框' OR ISNULL(dict_sql, N'') <> @dictConclusion);
PRINT N'  [OK] 总结论 → 下拉框(合格/不合格)';

/* 4.2 处理方式(纸面「处理意见」):允收 / 合格 / 不合格 / 报废。
 *     ⚠ hidden 保持 1、visible / place 一律不动 —— 本单历史值「合格转序」(417 行)仍在,
 *       放开显示会把它当成异常列露出;只改下拉属性,存量值原样保留。 */
DECLARE @dictDisposal nvarchar(500) =
        N'SELECT v FROM (VALUES (N''允收''),(N''合格''),(N''不合格''),(N''报废'')) AS t(v)';
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'处理方式') <> 1
  RAISERROR(N'[FAIL] QC_PROC_INSP.处理方式 登记行数不为 1,无法改下拉框', 16, 1);
UPDATE yj_field
   SET data_type = N'下拉框', dict_sql = @dictDisposal
 WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'处理方式'
   AND (ISNULL(data_type, N'') <> N'下拉框' OR ISNULL(dict_sql, N'') <> @dictDisposal);
PRINT N'  [OK] 处理方式 → 下拉框(允收/合格/不合格/报废;hidden 保持 1)';
GO

/* ═════════════ 5. 字段译名(scope=field,10 语种;已有 en 的标签只补缺) ═════════════
 * 规范:同一中文标签全局共享译名 —— 用 ref_key + locale 唯一性守卫,不重复插。 */
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

/* ═════════════ 6. 改名:组装成品检验单 → 出货检验表观(只改显示名) ═════════════ */
PRINT N'== 6. 面板改名 ==';
UPDATE yj_panel
   SET panel_name    = N'出货检验表观',
       panel_name_en = N'Outgoing Inspection Sheet (Appearance)'
 WHERE panel_code = N'QC_ASM_INSP'
   AND (ISNULL(panel_name, N'') <> N'出货检验表观'
        OR ISNULL(panel_name_en, N'') <> N'Outgoing Inspection Sheet (Appearance)');
PRINT N'  [OK] yj_panel.QC_ASM_INSP → 出货检验表观';

/* 新面板键补 10 语种译名;旧键「组装成品检验单」的译名保留不删(历史引用兜底)。 */
DECLARE @tp TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @tp (locale, text) VALUES
  ('en', N'Outgoing Inspection Sheet (Appearance)'),
  ('ja', N'出荷検査表（外観）'),
  ('ko', N'출하 검사표(외관)'),
  ('de', N'Ausgangsprüfblatt (Aussehen)'),
  ('es', N'Hoja de inspección de salida (aspecto)'),
  ('fr', N'Feuille d''inspection de sortie (aspect)'),
  ('ru', N'Лист выходного контроля (внешний вид)'),
  ('vi', N'Phiếu kiểm tra xuất hàng (ngoại quan)'),
  ('th', N'ใบตรวจสอบขาออก (ลักษณะภายนอก)'),
  ('zh-TW', N'出貨檢驗表觀');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'panel', N'出货检验表观', t.locale, t.text, N'manual'
  FROM @tp t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'panel' AND x.ref_key = N'出货检验表观' AND x.locale = t.locale);
PRINT N'  [OK] 面板译名「出货检验表观」10 语种(旧键「组装成品检验单」保留)';
GO

/* ═════════════ 7. 自检(不符即 RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log) ═════════════ */
PRINT N'== 7. 自检 ==';
DECLARE @bad int = 0;

/* 7.1 物理列 */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'内部批次') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'内部批次清单') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'表单审核人') IS NULL SET @bad = @bad + 1;

/* 7.2 列级中文注明(3 列都有) */
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'内部批次', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'内部批次清单', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
       AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'表单审核人', 'ColumnId')
       AND name = N'MS_Description') = 0 SET @bad = @bad + 1;

/* 7.3 yj_field 三行:登记数各 1、可见性/可编辑性达标 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次'
                AND place LIKE N'%detail%' AND hidden = 0 AND visible = 1 AND editable = 1 AND required = 0
                AND ISNULL(seq, 0) > 0) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次清单') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'内部批次清单'
                AND place = N'header' AND hidden = 1 AND visible = 0 AND editable = 1) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表单审核人') <> 1 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'表单审核人'
                AND place = N'header' AND hidden = 1 AND visible = 0 AND editable = 1) SET @bad = @bad + 1;

/* 7.4 明细侧 seq 不撞号(同 seq 只能靠 id 兜底排序 = 列序不稳) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%detail%'
             GROUP BY seq HAVING COUNT(*) > 1) SET @bad = @bad + 1;

/* 7.5 下拉框:总结论 合格/不合格;处理方式 允收/合格/不合格/报废 且 hidden 仍为 1 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'总结论'
                AND data_type = N'下拉框' AND dict_sql LIKE N'%合格%' AND dict_sql LIKE N'%不合格%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'处理方式'
                AND data_type = N'下拉框' AND dict_sql LIKE N'%允收%'
                AND dict_sql LIKE N'%报废%' AND dict_sql LIKE N'%不合格%' AND hidden = 1) SET @bad = @bad + 1;

/* 7.6 译名:4 个字段标签 en 在且各 10 语种;面板新键 en 在 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次清单' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'表单审核人' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检测周期' AND locale = 'en') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'内部批次清单') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'表单审核人') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'检测周期') < 10 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'出货检验表观' AND locale = 'en') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'panel' AND ref_key = N'出货检验表观') < 10 SET @bad = @bad + 1;

/* 7.7 改名:新名就位、旧名不再出现在 yj_panel;旧键译名仍是兜底(刻意保留) */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP' AND panel_name = N'出货检验表观') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_name = N'组装成品检验单') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'组装成品检验单' AND locale = 'en') SET @bad = @bad + 1;

/* 7.8 只改显示名的红线:代号/底表/单号前缀一个都不许动 */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'
                AND line_table = N'qc_asm_insp_detail' AND head_table = N'qc_asm_insp_head' AND prefix = 'ZJ') SET @bad = @bad + 1;

/* 7.9 派生列「检测周期」不进元数据(建了会触发体检 05 元数据漂移) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检测周期') SET @bad = @bad + 1;

IF @bad > 0
  RAISERROR(N'出货检验功能记录表(批次矩阵)迁移自检失败:见脚本第 7 节各项', 16, 1);
ELSE
  PRINT N'[OK] 自检全部通过:3 新列 + 3 条注明 + 3 行 yj_field + 2 个下拉框 + 10 语种译名 + 面板改名(代号/底表/前缀 ZJ 未动)';
GO
