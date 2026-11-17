/* migrate-inv-process-inspection-20261114.sql(2026-11-14)
 *
 * 商品档案加「是否过程检验」开关 —— 决定该商品的**生产工单**是否随报工**自动生成**三张过程检验单:
 *   首件检验单 QC_FIRST_INSP / 出货检验单功能 QC_PROC_INSP / 出货检验表观 QC_ASM_INSP。
 *
 * 用户口径(2026-11-14 原话):
 *   「为现在的生产过程检验增加一个设置在商品中,针对当前的首件检验,出货功能检验,出货检验表观三个单据
 *    作为当前生产工单的三个过程检验作为实现。简单来说就是将当前存在这个选择是否检验的商品进行确定
 *    是否走过程检验流程,但是如果那个工单需要被手工新增检验单也是可以手动新增的,就是自动生成不进行了。」
 *   ⇒ 开关只管「自动生成」;三张检验单的**手工新增入口一律不受影响**(见 QcInspAutoService 的开关说明)。
 *   默认值经用户 2026-11-14 拍板 = **否**:迁移后自动出单先停,需要自动出单的商品逐个勾成「是」。
 *
 * 落点:
 *   1. bs_inv + 列 [是否过程检验] bit NULL,DEFAULT (0)(否);存量行回填 0;
 *   2. yj_field 登记一行(INV / place=detail / data_type=是否),商品面板列表里即出现该列,
 *      点格变开关(与 是否可采购 / 是否可销售 同一套元数据驱动渲染),保存走档案「只提交改动行」;
 *   3. 列级 MS_Description 中文注明;
 *   4. 字段译名 10 语种(scope='field';同一个中文标签全库共享译名,NOT EXISTS 守卫)。
 *
 * 不改(刻意):
 *   · 面板代号 INV / 物理表 bs_inv / 菜单 / 权限一律不动;
 *   · 既有的「来料检验」(文本 是/否,采购链分流)与「是否检验」(bit,历史字段)不动 —— 本开关只服务生产工序检验;
 *   · 三张检验单面板/表/自动出单判据(QcInspAutoService)不动,只在其入口加一道商品开关闸;
 *   · 不回填/不清理任何检验单历史数据。
 *
 * 幂等:列用 COL_LENGTH 判空再 ADD(默认约束也判存在);yj_field / yj_translation 一律 NOT EXISTS 再 INSERT;
 *       重复执行 = 0 行变更、自检照旧 PASS。
 * 两账套都要执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST),执行方式:
 *   cd tools
 *   YINJIA_SQL_DB=HSDZ_MES      "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-inv-process-inspection-20261114.sql
 *   YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-inv-process-inspection-20261114.sql
 */

SET NOCOUNT ON;
GO

/* ═════════════ 0. 前置闸门:商品面板与物理表必须在 ═════════════ */
IF OBJECT_ID(N'dbo.bs_inv', N'U') IS NULL
  RAISERROR(N'[FAIL] 缺 dbo.bs_inv,本脚本无法继续', 16, 1);
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'INV') <> 1
  RAISERROR(N'[FAIL] yj_panel 缺 INV(商品)行(应为 1 行),本脚本无法继续', 16, 1);
PRINT N'[OK] 前置闸门:bs_inv、yj_panel.INV 全在';
GO

/* ═════════════ 1. 加列 + 默认值 + 存量回填 ═════════════ */
PRINT N'== 1. 加列 ==';
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NULL
BEGIN
  ALTER TABLE dbo.bs_inv ADD [是否过程检验] bit NULL;
  PRINT N'  [ADD] bs_inv.是否过程检验 bit NULL';
END
ELSE
  PRINT N'  [SKIP] bs_inv.是否过程检验 已存在';
GO

/* ⚠ 必须另起 GO 批:同一批里 ALTER ADD 的新列,后续语句在**批编译期**还不认
 *   (实测报 Invalid column name '是否过程检验'),与"表不存在才延迟解析"不是一回事。 */

/* 默认值(新行不传该列时=否;与用户拍板的默认值一致) */
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
                JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
               WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name = N'是否过程检验')
BEGIN
  ALTER TABLE dbo.bs_inv ADD CONSTRAINT [DF_bs_inv_是否过程检验] DEFAULT (0) FOR [是否过程检验];
  PRINT N'  [ADD] 默认约束 DF_bs_inv_是否过程检验 = 0(否)';
END
ELSE
  PRINT N'  [SKIP] 默认约束 已存在';

/* 存量行回填 0:列表里看得见「否」,而不是空白(默认否,用户 2026-11-14 拍板) */
DECLARE @filled int;
UPDATE dbo.bs_inv SET [是否过程检验] = 0 WHERE [是否过程检验] IS NULL;
SET @filled = @@ROWCOUNT;
PRINT N'  [BACKFILL] 存量回填「否」' + CAST(@filled AS nvarchar(20)) + N' 行';
GO

/* ═════════════ 2. 列级中文注明(有则改、无则加) ═════════════ */
PRINT N'== 2. 列级中文注明 ==';
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.bs_inv')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'是否过程检验', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'是否过程检验(否/是,默认否):是 ⇒ 该商品的生产工单随报工自动生成首件检验单/出货检验单功能/出货检验表观三张过程检验单;否 ⇒ 不自动生成(三张单仍可手工新增)。2026-11-14 新增',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'是否过程检验';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'是否过程检验(否/是,默认否):是 ⇒ 该商品的生产工单随报工自动生成首件检验单/出货检验单功能/出货检验表观三张过程检验单;否 ⇒ 不自动生成(三张单仍可手工新增)。2026-11-14 新增',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'是否过程检验';
PRINT N'[OK] 列级中文注明已写';
GO

/* ═════════════ 3. yj_field 登记(商品面板列表列 + 行内开关) ═════════════ */
PRINT N'== 3. yj_field 登记 ==';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INV' AND col_name = N'是否过程检验')
BEGIN
  /* seq=46 = 规格型号(40)之后、计价方式(50)之前;与用户截图红框位置一致;宽度按 是否 列统一 130 */
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'INV', N'是否过程检验', N'是否过程检验', N'是否', N'detail', 46, 130, 1, 0, 0, 1);
  PRINT N'  [INSERT] yj_field INV/是否过程检验';
END
ELSE
BEGIN
  /* 已存在时只校准渲染/编辑口径(不覆盖别人可能改过的 seq/width 之外的别名等) */
  UPDATE yj_field SET place = N'detail', data_type = N'是否', editable = 1, required = 0, hidden = 0, visible = 1
   WHERE panel_code = N'INV' AND col_name = N'是否过程检验';
  PRINT N'  [SKIP] yj_field INV/是否过程检验 已存在(属性已校准)';
END
GO

/* ═════════════ 4. 字段译名(10 语种;同一中文标签全库共享) ═════════════ */
DECLARE @labels TABLE (label nvarchar(60), en nvarchar(100), ja nvarchar(100), ko nvarchar(100), tw nvarchar(100),
                       es nvarchar(100), de nvarchar(100), fr nvarchar(100), ru nvarchar(100), vi nvarchar(100), th nvarchar(100));
INSERT INTO @labels VALUES
 (N'是否过程检验', N'Process Inspection', N'工程内検査', N'공정 검사', N'是否過程檢驗',
  N'Inspección de proceso', N'Prozessprüfung', N'Inspection en cours de fabrication',
  N'Проверка в процессе производства', N'Kiểm tra trong quá trình sản xuất', N'การตรวจสอบในกระบวนการผลิต');
DECLARE @label nvarchar(60), @en nvarchar(100), @ja nvarchar(100), @ko nvarchar(100), @tw nvarchar(100),
        @es nvarchar(100), @de nvarchar(100), @fr nvarchar(100), @ru nvarchar(100), @vi nvarchar(100), @th nvarchar(100);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT label, en, ja, ko, tw, es, de, fr, ru, vi, th FROM @labels;
OPEN cur;
FETCH NEXT FROM cur INTO @label, @en, @ja, @ko, @tw, @es, @de, @fr, @ru, @vi, @th;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'en')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'en', @en, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'ja')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'ja', @ja, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'ko')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'ko', @ko, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'zh-TW')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'zh-TW', @tw, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'es')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'es', @es, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'de')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'de', @de, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'fr')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'fr', @fr, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'ru')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'ru', @ru, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'vi')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'vi', @vi, N'manual');
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = @label AND locale = N'th')
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @label, N'th', @th, N'manual');
    FETCH NEXT FROM cur INTO @label, @en, @ja, @ko, @tw, @es, @de, @fr, @ru, @vi, @th;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 字段译名已补(10 语种)';
GO

/* ═════════════ 5. 自检 ═════════════ */
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NULL
  RAISERROR(N'[FAIL] bs_inv.是否过程检验 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
                JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
               WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name = N'是否过程检验'
                 AND dc.definition LIKE N'%(0)%')
  RAISERROR(N'[FAIL] bs_inv.是否过程检验 默认约束不存在或不是 (0)', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.bs_inv WHERE [是否过程检验] IS NULL)
  RAISERROR(N'[FAIL] bs_inv 仍有 是否过程检验 为 NULL 的存量行', 16, 1);
IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'INV' AND col_name = N'是否过程检验') <> 1
  RAISERROR(N'[FAIL] yj_field INV/是否过程检验 不是 1 行', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'INV' AND col_name = N'是否过程检验'
            AND (data_type <> N'是否' OR place <> N'detail' OR editable <> 1 OR hidden <> 0 OR visible <> 1))
  RAISERROR(N'[FAIL] yj_field INV/是否过程检验 属性不符(是否/detail/可编辑/可见)', 16, 1);
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key = N'是否过程检验'
       AND locale IN (N'en',N'ja',N'ko',N'zh-TW',N'es',N'de',N'fr',N'ru',N'vi',N'th')) < 10
  RAISERROR(N'[FAIL] 是否过程检验 译名不足 10 语种', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bs_inv')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'是否过程检验', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  RAISERROR(N'[FAIL] bs_inv.是否过程检验 缺列级 MS_Description', 16, 1);
PRINT N'[PASS] 自检通过:bs_inv.是否过程检验(bit/默认否/无 NULL)+ yj_field(INV/detail/是否/可见可编)+ 10 语种译名 + 列注明';
GO
