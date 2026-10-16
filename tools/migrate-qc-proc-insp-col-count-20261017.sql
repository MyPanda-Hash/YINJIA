/* migrate-qc-proc-insp-col-count-20261017.sql(2026-10-17):制程检验单表头加「列数」字段。
 *
 * 用户 2026-10-17 口径(接 2026-10-16 的「一个检验项目 = 一列」继续收敛):
 *   「仿照当前研发处的功能性滤效完成对这个制程检验单的实现能自定义增加表格列,
 *     然后针对当前制程检验表增加几个固定列,仿照图2的形式实现」
 *   拍板:① 改的是面板里的纸张表;② 固定列 = 外观组先铺「端盖两头」「管身两侧」;
 *         ③ 加列仿功能性滤效 —— **表头一个「列数」字段 + 表格外 −/＋ 控件**,
 *            列数决定各表区铺几列自定义列(所有表区统一),减列即清空该列数据。
 *
 * ⇒ 本脚本:给 qc_proc_insp_head 加 1 个整数列 `列数`(头字段,和 功能性滤效 的「样品数」同角色),
 *   补中文注明 + 登记 yj_field(place=header,hidden=1/visible=1:不进抬头格子,但值照存照取)
 *   + 多语言译名。**不回填**(空 = 没设过,界面按 min=1 渲染,点 −/＋ 才落库)。
 *
 * 登记口径参照同面板的 检验时间(hidden=1/visible=1):hidden 让纸张抬头不重复渲染它,
 * visible 保留在字段集里 —— 值能存能取(与 detail 侧 格数/格数上限 同理)。
 *
 * 规范:列名中文即语义;幂等(COL_LENGTH 判空再 ADD);两账套均执行(先正式后测试)。
 */

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'列数') IS NULL
  ALTER TABLE dbo.qc_proc_insp_head ADD 列数 int NULL;
GO

/* ============ B. 列级中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'列数', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'纸张横表各表区铺几列自定义检验项目列(1..10);仿功能性滤效的「样品数」,由表格外 −/＋ 控件维护',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_head', N'COLUMN', N'列数';
GO

/* ============ C. yj_field 登记(表头字段,hidden=1/visible=1) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'列数')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'列数', N'列数', N'整数', N'header', 290, 60, 1, 0, 1, 1);
ELSE
  UPDATE yj_field SET data_type = N'整数', place = N'header', seq = 290, width = 60, editable = 1
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'列数';
GO

/* ============ D. 多语言(新字段至少 en;其余语言一并给) ============ */
DECLARE @t TABLE (locale nvarchar(10), text nvarchar(100));
INSERT INTO @t (locale, text) VALUES
  (N'en', N'Columns'), (N'ja', N'列数'), (N'ko', N'열 수'), (N'de', N'Spalten'), (N'es', N'Columnas'),
  (N'fr', N'Colonnes'), (N'ru', N'Столбцы'), (N'th', N'จำนวนคอลัมน์'), (N'vi', N'Số cột'), (N'zh-TW', N'列數');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'列数', t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = N'列数' AND x.locale = t.locale);
GO

/* ============ E. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'列数') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'列数') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'列数') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_head')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_head'), N'列数', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单「列数」迁移自检失败', 16, 1);
ELSE PRINT N'制程检验单「列数」就绪(头字段 + 注明 + 字段登记 + 10 语言译名)';
GO
