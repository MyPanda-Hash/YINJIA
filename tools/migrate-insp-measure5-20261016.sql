/* migrate-insp-measure5-20261016.sql(2026-10-16)
 * 工序检验单(成型 CX / 切炭 QT / 组装成品 ZJ=成品检验单)每行增加 **5 个测量值**列
 *
 * 【用户口径(2026-10-16)】「为当前每行增加五个测量值实现这个完成」
 *   —— 承接同日的 migrate-insp-req-align-20261016.sql(检验要求/检验方法/检查频率已与出货检验计划表对齐):
 *      那批解决"标准怎么带进来",这批解决"实测的几个数值怎么落格"。
 *
 * 【为什么是 5 个】出货检验计划表的「尺寸」「出货重量」在抽检量 5 的场景下要逐格记录
 *   (制程检验单 2026-10-12 就是按截图给 尺寸/出货重量 各开 5 个测量值格:
 *    migrate-qc-proc-insp-measure-cols.sql → 后又扩到 10 格 migrate-qc-proc-insp-measure10.sql)。
 *   本次把同样的"一行多个测量值"能力补给三张工序检验单,每个检验项目一行、自带 5 格。
 *
 * 【本脚本做什么】
 *   A. 三张明细表各加 测量值1..5 decimal(18,4)(与原「实测数值」文本列**并存**:
 *      实测数值 继续承载 定性描述/一串文本,测量值1..5 承载逐格数值,互不覆盖);
 *   B. 列级中文注明(15 条:3 表 × 5 列);
 *   C. yj_field 登记(data_type=小数 / place=detail / width=80 / 可编辑可见);
 *   D. 多语言:测量值1..5 的 en 译名(Measured 1..5)在制程检验单那批**已存在**且按标签全局共享,
 *      本脚本只做兜底插入(已存在则跳过);
 *   E. 自检(列/字段/注明/译名)。
 *
 * 【列序(seq)安排】5 格统一落在 **300..304** 这段空窗(两账套都空:「数量 250」之后、「不合格数量 310」之前),
 *   同一脚本在两个账套落出完全一样的次序;成型/切炭 另把 检验方法 235→225、检查频率 236→228 前移
 *   (它们原先压在 实测数值230 之后,与"标准列在前、实测数据在后"的读法相反;纯显示次序、不动数据)。
 *   为什么不贴着「实测数值」排:两账套明细 seq 布局不同源(正式库 组装成品 实测数值=30/检验方法=40,
 *   测试库快照 实测数值=230/检验方法=235),贴着实测数值插必然撞号,而撞号只能按 id 兜底排序、次序不可控。
 *
 * 【幂等】加列走 COL_LENGTH 判空,登记走 NOT EXISTS,注明走 NOT EXISTS,seq 只在不等时更新;
 *   两账套(先正式后测试)均执行。
 * 【不动】制程检验单(已有 测量值1..10)、计划表、任何单据行数据、报表模板。
 */

/* ══════════════════ A. 加列:测量值1..5 decimal(18,4) ══════════════════ */
DECLARE @t sysname, @i int, @col sysname;
DECLARE curA CURSOR LOCAL FAST_FORWARD FOR
  SELECT v FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v);
OPEN curA FETCH NEXT FROM curA INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @i = 1;
  WHILE @i <= 5
  BEGIN
    SET @col = N'测量值' + CAST(@i AS nvarchar(2));
    IF COL_LENGTH(N'dbo.' + @t, @col) IS NULL
    BEGIN
      EXEC(N'ALTER TABLE dbo.' + @t + N' ADD ' + @col + N' decimal(18,4) NULL');
      PRINT N'[OK] ' + @t + N'.' + @col + N' 已加';
    END
    ELSE PRINT N'[SKIP] ' + @t + N'.' + @col + N' 已存在';
    SET @i = @i + 1;
  END
  FETCH NEXT FROM curA INTO @t;
END
CLOSE curA DEALLOCATE curA;
GO

/* ══════════════════ B. 列级中文注明(3 表 × 5 列) ══════════════════ */
DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(300));
INSERT INTO @cols VALUES
 (N'qc_mold_insp_detail', N'测量值1', N'实测值第1个(尺寸/重量类检验项目按抽检量逐格记录)'),
 (N'qc_mold_insp_detail', N'测量值2', N'实测值第2个'),
 (N'qc_mold_insp_detail', N'测量值3', N'实测值第3个'),
 (N'qc_mold_insp_detail', N'测量值4', N'实测值第4个'),
 (N'qc_mold_insp_detail', N'测量值5', N'实测值第5个'),
 (N'qc_cut_insp_detail',  N'测量值1', N'实测值第1个(尺寸/重量类检验项目按抽检量逐格记录)'),
 (N'qc_cut_insp_detail',  N'测量值2', N'实测值第2个'),
 (N'qc_cut_insp_detail',  N'测量值3', N'实测值第3个'),
 (N'qc_cut_insp_detail',  N'测量值4', N'实测值第4个'),
 (N'qc_cut_insp_detail',  N'测量值5', N'实测值第5个'),
 (N'qc_asm_insp_detail',  N'测量值1', N'实测值第1个(尺寸/重量类检验项目按抽检量逐格记录)'),
 (N'qc_asm_insp_detail',  N'测量值2', N'实测值第2个'),
 (N'qc_asm_insp_detail',  N'测量值3', N'实测值第3个'),
 (N'qc_asm_insp_detail',  N'测量值4', N'实测值第4个'),
 (N'qc_asm_insp_detail',  N'测量值5', N'实测值第5个');
DECLARE @tb nvarchar(60), @cl sysname, @nt nvarchar(300);
DECLARE curB CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curB FETCH NEXT FROM curB INTO @tb, @cl, @nt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @tb, @cl) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID(N'dbo.' + @tb)
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tb), @cl, 'ColumnId')
                        AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @nt, N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @cl;
  FETCH NEXT FROM curB INTO @tb, @cl, @nt;
END
CLOSE curB DEALLOCATE curB;
GO

/* ══════════════════ C. yj_field 登记 ══════════════════ */
/* C0. 成型/切炭:把 检验方法/检查频率 前移(235→225、236→228),给 5 格空出 231..235(纯显示次序) */
UPDATE yj_field SET seq = 225 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP') AND col_name = N'检验方法' AND seq = 235;
UPDATE yj_field SET seq = 228 WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP') AND col_name = N'检查频率' AND seq = 236;
GO

/* C1. 测量值1..5 登记:统一用 **300..304** 这段空窗(紧接「数量」之后、「不合格数量 310」之前)。
       ⚠ 为什么不贴着「实测数值」排:两个账套的明细 seq 布局不同源(正式库组装成品 实测数值=30、
        检验方法=40;测试库快照 实测数值=230、检验方法=235),贴着实测数值插会与 检验方法/检查频率
        撞号,而撞号后同 seq 只能按 id 兜底排序、次序不可控。用一段两账套都空着的窗口,
        同一脚本在两个账套落出**完全一样的次序**,且不触碰任何既有字段的 seq。 */
DECLARE @fp TABLE (panel nvarchar(30));
INSERT INTO @fp VALUES (N'QC_ASM_INSP'), (N'QC_MOLD_INSP'), (N'QC_CUT_INSP');
DECLARE @p nvarchar(30), @k int, @c2 sysname, @s int;
DECLARE curC CURSOR LOCAL FAST_FORWARD FOR SELECT panel FROM @fp;
OPEN curC FETCH NEXT FROM curC INTO @p;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @k = 1;
  WHILE @k <= 5
  BEGIN
    SET @c2 = N'测量值' + CAST(@k AS nvarchar(2));
    SET @s = 300 + @k - 1;
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @p AND col_name = @c2)
      INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
      VALUES (@p, @c2, @c2, N'小数', N'detail', @s, 80, 1, 0, 0, 1);
    ELSE
      UPDATE yj_field SET data_type = N'小数', place = N'detail', seq = @s, width = 80, editable = 1, visible = 1
       WHERE panel_code = @p AND col_name = @c2 AND (place <> N'detail' OR seq <> @s OR visible = 0);
    SET @k = @k + 1;
  END
  FETCH NEXT FROM curC INTO @p;
END
CLOSE curC DEALLOCATE curC;
GO

/* ══════════════════ D. 多语言(测量值1..5 已有 en 且按标签全局共享,这里只兜底) ══════════════════ */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(100));
INSERT INTO @ft VALUES (N'测量值1', N'Measured 1'), (N'测量值2', N'Measured 2'), (N'测量值3', N'Measured 3'),
                       (N'测量值4', N'Measured 4'), (N'测量值5', N'Measured 5');
DECLARE @lb nvarchar(50), @en nvarchar(100);
DECLARE curD CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curD FETCH NEXT FROM curD INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @lb AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', @lb, N'en', @en, N'manual');
  FETCH NEXT FROM curD INTO @lb, @en;
END
CLOSE curD DEALLOCATE curD;
GO

/* ══════════════════ E. 自检 ══════════════════ */
DECLARE @bad int = 0, @m int, @cc sysname, @tb2 sysname;
/* E1. 三张表 × 5 列都在 */
DECLARE curE CURSOR LOCAL FAST_FORWARD FOR
  SELECT v FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v);
OPEN curE FETCH NEXT FROM curE INTO @tb2;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @m = 1;
  WHILE @m <= 5
  BEGIN
    SET @cc = N'测量值' + CAST(@m AS nvarchar(2));
    IF COL_LENGTH(N'dbo.' + @tb2, @cc) IS NULL SET @bad = @bad + 1;
    SET @m = @m + 1;
  END
  FETCH NEXT FROM curE INTO @tb2;
END
CLOSE curE DEALLOCATE curE;
/* E2. yj_field:三张单各有 5 个 测量值N(detail、小数、可见) */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
      AND col_name LIKE N'测量值%' AND place = N'detail' AND data_type = N'小数' AND visible = 1) < 15 SET @bad = @bad + 1;
/* E3. 列级注明 15 条 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.name = N'MS_Description' AND ep.class = 1 AND ep.minor_id > 0
       AND OBJECT_NAME(ep.major_id) IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail')
       AND COL_NAME(ep.major_id, ep.minor_id) LIKE N'测量值%') < 15 SET @bad = @bad + 1;
/* E4. 列序/不撞号:测量值1 在 实测数值 之后;且 5 格的 seq 在**本面板内唯一**
       (同 seq 只能按 id 兜底排序 ⇒ 撞号等于次序不可控,必须为 0) */
IF EXISTS (SELECT 1 FROM yj_field m JOIN yj_field r ON r.panel_code = m.panel_code AND r.col_name = N'实测数值'
            WHERE m.panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') AND m.col_name = N'测量值1'
              AND m.seq <= r.seq) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field a JOIN yj_field b
             ON b.panel_code = a.panel_code AND b.seq = a.seq AND b.id <> a.id
            WHERE a.panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP')
              AND a.col_name LIKE N'测量值%') SET @bad = @bad + 1;
/* E5. 译名齐 */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND locale = N'en'
      AND ref_key IN (N'测量值1', N'测量值2', N'测量值3', N'测量值4', N'测量值5')) < 5 SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'工序检验单「测量值1..5」迁移自检失败(列/字段/注明/次序/译名)', 16, 1);
ELSE PRINT N'测量值1..5 就绪:三张工序检验单(成型/切炭/组装成品=成品检验单)每行 5 个测量值格'
        + N'(列 + 注明 + yj_field + 译名;实测数值 文本列并存不动)';
GO
