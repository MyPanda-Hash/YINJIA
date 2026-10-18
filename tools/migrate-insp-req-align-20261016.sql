/* migrate-insp-req-align-20261016.sql(2026-10-16)
 * 工序检验单字段对齐「出货检验计划表」+ 成品检验可取出货检验计划的检验要求/检验方法/检查频率
 *
 * 【用户口径(2026-10-16,截图《出货检验项目控制计划》RD_INSP_PLAN,四个红框)】
 *   ①「当前成品检验单实现方式需要修改,要能获取到出货检验计划中的内容,当前红框内容都需要是能获取到的」
 *      ⇒ 红框 = **产品编号 / 检验要求 / 检验方法 / 检查频率**;
 *   ②「将当前标准要求的这种字段修改为和出货检验计划一致的检验要求,检验方法需要实现可一一对应」
 *      ⇒ 三张工序检验单(成型 CX / 切炭 QT / 组装成品 ZJ,后者=成品检验单)明细列
 *        「标准要求」按计划表用词**正名为「检验要求」**,与已建成的制程检验单同口径。
 *
 * 【现状(实库 HSDZ_MES 实测)】
 *   · 制程检验单 QC_PROC_INSP 已齐:检验要求(migrate-qc-proc-insp.sql 2026-10-12)+ 检查频率
 *     (migrate-qc-proc-insp-freq-col.sql 2026-10-13)+ 检验方法(2026-10-09),取数接口
 *     `GET /api/qc/inspPlan/fromShipPlan` 也已按 产品编码 映射好(控制标准及要求→检验要求、
 *     控制方法→检验方法、检测频率→检查频率)。
 *   · 三张工序检验单缺两样:**明细列叫「标准要求」**(与计划表用词不一致)+ **没有「检查频率」列**;
 *     虽说 migrate-qc-item-plan.sql 已给三张单补过「检验方法」列,但没有取数入口 ⇒ 取不到。
 *
 * 【本脚本做什么(只加列/改名/登记,不动任何单据数据与分流逻辑)】
 *   A. 物理列改名 `标准要求` → `检验要求`(三张明细表;sp_rename,幂等:新列不存在且旧列存在才动);
 *   B. 补 `检查频率` nvarchar(50)(三张明细表,镜像 qc_proc_insp_detail.检查频率 的类型与取值);
 *   C. yj_field:`检验要求` 行的 col_name/label 同步改名;`检查频率` 登记(detail,下拉字典与制程检验单同源);
 *   D. 多语言:`检验要求`/`检查频率` 在 yj_translation 里**已有 10 语言译名**(制程检验单那批落的),
 *      本脚本只做 en 兜底插入(已存在则跳过)——AGENTS.md「同一中文标签全局共享译名」;
 *   E. 中文注明:两列各写 MS_Description,写明来源列(计划表哪个字段);
 *   F. 自检(列/字段/注明/译名/无残留旧列名),不达标 RAISERROR。
 *
 * 【为什么这样落】
 *   · 「一一对应」= 计划表一行 → 检验单一行,四个字段各归各列:控制项目→检验项目、
 *     控制标准及要求→检验要求、控制方法→检验方法、检测频率→检查频率(映射代码在
 *     QcInspPlanController#fromShipPlan,本脚本只把**载体列**补齐,不改映射);
 *   · 改名采用**物理列改名 + yj_field 同步**两处(列名安全规范「改名三处同步」的第三处=重建视图;
 *     探针实测**无任何视图引用这三张明细表**,故无第三处)——只改 yj_field.label 会导致
 *     dataName(前端数据键=label)与物理列分家,保存链路 def.byLabel→col 仍然通,但库里列名与
 *     界面用词永久不一致,后续对账/报表都要打补丁,故一次改到底;
 *   · **不动 data_type**:三行「检验要求」原本已是 `多行文本`(migrate-field-multiline-text-20261015.sql
 *     按标签批量改的),改名只动 col_name/label,长文本(E20 那种长标准)能力原样保留。
 *
 * 【幂等】改名/加列走 COL_LENGTH 守卫,登记走 NOT EXISTS,注明走 NOT EXISTS;两账套(先正式后测试)均执行。
 * 【不动】制程检验单(已齐)、计划表本体、任何单据行数据、报表模板。
 */

/* ══════════════════ A. 物理列改名:标准要求 → 检验要求 ══════════════════ */
DECLARE @t sysname, @obj sysname;
DECLARE curA CURSOR LOCAL FAST_FORWARD FOR
  SELECT v FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v);
OPEN curA FETCH NEXT FROM curA INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @t, N'检验要求') IS NULL AND COL_LENGTH(N'dbo.' + @t, N'标准要求') IS NOT NULL
  BEGIN
    SET @obj = N'dbo.' + @t + N'.标准要求';
    EXEC sp_rename @obj, N'检验要求', N'COLUMN';
    PRINT N'[OK] ' + @t + N'.标准要求 → 检验要求';
  END
  ELSE
    PRINT N'[SKIP] ' + @t + N' 改名(已是 检验要求 或无 标准要求 源列)';
  FETCH NEXT FROM curA INTO @t;
END
CLOSE curA DEALLOCATE curA;
GO

/* ══════════════════ B. 补列:检查频率 nvarchar(50)(镜像制程检验单) ══════════════════ */
DECLARE @t2 sysname;
DECLARE curB CURSOR LOCAL FAST_FORWARD FOR
  SELECT v FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v);
OPEN curB FETCH NEXT FROM curB INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
  /* ⚠ 2026-10-17 加表存在性守卫(此前把整条迁移链卡死):qc_mold_insp_detail / qc_cut_insp_detail
     已被**链上更靠后**的 migrate-drop-qc-mold-cut-finspec-20261016.sql 下架。本脚本只要
     内容哈希一变就会被 DbSync 判为「变更,重新执行」,而少了这道守卫就会去 ALTER 一张
     不存在的表 ⇒ `Cannot find the object "dbo.qc_mold_insp_detail"` ⇒ 中止 ⇒
     其后迁移全部不执行(正式库曾因此在库存报表那支之后连丢 13 条)。asm 表仍在,照常补列。 */
  IF OBJECT_ID(N'dbo.' + @t2, N'U') IS NULL
    PRINT N'[SKIP] ' + @t2 + N' 不存在(已下架,跳过补列)';
  ELSE IF COL_LENGTH(N'dbo.' + @t2, N'检查频率') IS NULL
  BEGIN
    EXEC(N'ALTER TABLE dbo.' + @t2 + N' ADD 检查频率 nvarchar(50) NULL');
    PRINT N'[OK] ' + @t2 + N'.检查频率 已加';
  END
  ELSE PRINT N'[SKIP] ' + @t2 + N'.检查频率 已存在';
  FETCH NEXT FROM curB INTO @t2;
END
CLOSE curB DEALLOCATE curB;
GO

/* ══════════════════ C. yj_field 登记 ══════════════════ */

/* C1. 改名行同步:col_name 与 label 一起改(前端数据键=label,物理列=col_name,两者必须同名) */
UPDATE yj_field SET col_name = N'检验要求', label = N'检验要求'
 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
   AND col_name = N'标准要求';
PRINT N'[OK] yj_field 改名行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* C2. 新增「检查频率」字段行:seq 夹在 检验方法 与 判定 之间(组装 45;成型/切炭 236),
       下拉字典与制程检验单同源(RD_INSP_PLAN.检测频率 的三个取值)。 */
DECLARE @fp TABLE (panel nvarchar(30), seq int);
INSERT INTO @fp VALUES (N'QC_ASM_INSP', 45), (N'QC_MOLD_INSP', 236), (N'QC_CUT_INSP', 236);
DECLARE @p nvarchar(30), @s int;
DECLARE curC CURSOR LOCAL FAST_FORWARD FOR SELECT panel, seq FROM @fp;
OPEN curC FETCH NEXT FROM curC INTO @p, @s;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @p AND col_name = N'检查频率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
    VALUES (@p, N'检查频率', N'检查频率', N'下拉框',
            N'SELECT v FROM (VALUES (N''1PCS/一个生产批次''),(N''生产量*1%''),(N''型式检验'')) AS t(v)',
            N'detail', @s, 110, 1, 0, 0, 1);
  ELSE
    UPDATE yj_field SET place = N'detail', seq = @s
     WHERE panel_code = @p AND col_name = N'检查频率' AND (place <> N'detail' OR seq <> @s);
  FETCH NEXT FROM curC INTO @p, @s;
END
CLOSE curC DEALLOCATE curC;
GO

/* ══════════════════ D. 多语言(en 兜底;全语言译名已由制程检验单那批落库) ══════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验要求' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'检验要求', N'en', N'Inspection Requirement', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检查频率' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'检查频率', N'en', N'Inspection Frequency', N'manual');
GO

/* ══════════════════ E. 中文注明(列级;新列与改名列都要有) ══════════════════ */
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols VALUES
 (N'qc_mold_insp_detail', N'检验要求', N'检验要求(来源=出货检验计划表 RD_INSP_PLAN.控制标准及要求;2026-10-16 由「标准要求」正名对齐,长文本)'),
 (N'qc_cut_insp_detail',  N'检验要求', N'检验要求(来源=出货检验计划表 RD_INSP_PLAN.控制标准及要求;2026-10-16 由「标准要求」正名对齐,长文本)'),
 (N'qc_asm_insp_detail',  N'检验要求', N'检验要求(来源=出货检验计划表 RD_INSP_PLAN.控制标准及要求;2026-10-16 由「标准要求」正名对齐,长文本)'),
 (N'qc_mold_insp_detail', N'检查频率', N'检查频率(来源=出货检验计划表 RD_INSP_PLAN.检测频率;取值 1PCS/一个生产批次 · 生产量*1% · 型式检验)'),
 (N'qc_cut_insp_detail',  N'检查频率', N'检查频率(来源=出货检验计划表 RD_INSP_PLAN.检测频率;取值 1PCS/一个生产批次 · 生产量*1% · 型式检验)'),
 (N'qc_asm_insp_detail',  N'检查频率', N'检查频率(来源=出货检验计划表 RD_INSP_PLAN.检测频率;取值 1PCS/一个生产批次 · 生产量*1% · 型式检验)');
DECLARE @tb nvarchar(60), @cl sysname, @nt nvarchar(400);
DECLARE curE CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curE FETCH NEXT FROM curE INTO @tb, @cl, @nt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @tb, @cl) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID(N'dbo.' + @tb)
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb), @cl, 'ColumnId')
                        AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @nt, N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @cl;
  FETCH NEXT FROM curE INTO @tb, @cl, @nt;
END
CLOSE curE DEALLOCATE curE;
GO

/* ══════════════════ F. 自检 ══════════════════ */
/* ⚠ 2026-10-17:期望值由写死的 3 张表/3 个面板改成**按仍存在的对象动态算** ——
   qc_mold/qc_cut 两表与 QC_MOLD_INSP/QC_CUT_INSP 两面板已被链上更靠后的
   migrate-drop-qc-mold-cut-finspec-20261016.sql 下架,写死 3/6 会让本脚本重跑时永远 FAIL。 */
DECLARE @bad int = 0;
DECLARE @pairs TABLE (tb sysname, cl sysname);
INSERT INTO @pairs VALUES
 (N'qc_mold_insp_detail', N'检验要求'), (N'qc_mold_insp_detail', N'检查频率'),
 (N'qc_cut_insp_detail',  N'检验要求'), (N'qc_cut_insp_detail',  N'检查频率'),
 (N'qc_asm_insp_detail',  N'检验要求'), (N'qc_asm_insp_detail',  N'检查频率');

DECLARE @expTable int = (SELECT COUNT(*) FROM @pairs p WHERE OBJECT_ID(N'dbo.' + p.tb, N'U') IS NOT NULL);
DECLARE @expNote  int = (SELECT COUNT(*) FROM @pairs p WHERE COL_LENGTH(N'dbo.' + p.tb, p.cl) IS NOT NULL);
DECLARE @expPanel int = (SELECT COUNT(*) FROM yj_panel
                          WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP'));

/* F1. **仍存在**的表里两列都在(检验要求/检查频率);且旧列名 标准要求 已不存在 */
IF EXISTS (SELECT 1 FROM @pairs p WHERE OBJECT_ID(N'dbo.' + p.tb, N'U') IS NOT NULL
             AND COL_LENGTH(N'dbo.' + p.tb, p.cl) IS NULL) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM @pairs p WHERE OBJECT_ID(N'dbo.' + p.tb, N'U') IS NOT NULL
             AND COL_LENGTH(N'dbo.' + p.tb, N'标准要求') IS NOT NULL) SET @bad = @bad + 1;
/* F2. yj_field:检验要求(place 含 detail)与 检查频率(detail)各 @expPanel 行;旧列名 0 行 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
      AND col_name = N'检验要求' AND place LIKE N'%detail%') < @expPanel SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
      AND col_name = N'检查频率' AND place = N'detail') < @expPanel SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
      AND col_name = N'标准要求') > 0 SET @bad = @bad + 1;
/* F3. 检查频率 必须带下拉字典(与制程检验单同源) */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
      AND col_name = N'检查频率' AND data_type = N'下拉框' AND ISNULL(dict_sql, N'') <> N'') < @expPanel SET @bad = @bad + 1;
/* F4. 列级注明齐(仍存在的表 × 两列) */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
      JOIN @pairs p ON ep.major_id = OBJECT_ID(N'dbo.' + p.tb)
                   AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + p.tb), p.cl, 'ColumnId')
     WHERE ep.name = N'MS_Description' AND ep.class = 1 AND ep.minor_id > 0) < @expNote SET @bad = @bad + 1;
/* F5. en 译名在 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验要求' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检查频率' AND locale = N'en') SET @bad = @bad + 1;
/* F6. 空库提示(不做失败判定;表已下架则免测 —— 用动态 SQL 避免引用不存在的表) */
IF @expTable > 0
BEGIN
  DECLARE @sqlF6 nvarchar(max) = N'';
  SELECT @sqlF6 = @sqlF6 + N'IF (SELECT COUNT(*) FROM dbo.' + p.tb + N') = 0 '
    FROM @pairs p WHERE OBJECT_ID(N'dbo.' + p.tb, N'U') IS NOT NULL;
  IF @sqlF6 <> N''
  BEGIN
    SET @sqlF6 = @sqlF6 + N'PRINT N''[WARN] 明细表当前均为 0 行(空库属正常,不做失败判定)''';
    EXEC sp_executesql @sqlF6;
  END
END

PRINT N'[自检] 仍存在的表 ' + CAST(@expTable AS nvarchar(10)) + N' / 列注明应齐 ' + CAST(@expNote AS nvarchar(10))
    + N' 条 / 仍在册面板 ' + CAST(@expPanel AS nvarchar(10)) + N' 个;不符项 ' + CAST(@bad AS nvarchar(10)) + N' 条';
IF @bad > 0 RAISERROR(N'工序检验单「检验要求/检查频率」对齐迁移自检失败(列/字段/字典/注明/译名)', 16, 1);
ELSE PRINT N'检验要求/检查频率 就绪:工序检验单列改名+补列+yj_field+注明+译名,'
        + N'与出货检验计划表 RD_INSP_PLAN 的 控制标准及要求/控制方法/检测频率 一一对应';
GO
