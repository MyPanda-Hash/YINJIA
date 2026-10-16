/* migrate-qc-proc-insp-cell-count.sql(2026-10-16):制程检验单明细加「格数」列。
 *
 * 用户 2026-10-16 口径:
 *   ①「让当前检验项目可以选择多少格框线可以吗?再让当前框线可以增加实现」
 *   ②「当前表可以不实现增加行,只需要保持原有的列增加和列表格增加即可」
 *   ③ 拍板(甲-1):「一个检验项目 = 一列,列内格数可加减」
 *
 * ⇒ 横表从「组内 项目为行 / 测量值为列」改成 **一项一列**:
 *     每个检验项目(一条明细行)= 横表里的一列,列内格数由本行的「格数」决定。
 *       定量(表区名含 尺寸/重量/厚度/直径/长度/宽度/高度): 第 k 格 = 测量值k(已有列,小数)
 *       定性(其余表区,如外观/性能):                          第 k 格 = 实测数值 按 "/" 拆的第 k 段
 *     新增 = 组内「＋」(加一列) 或 「＋新增表区」(加一张表);**没有"加行"**。
 *
 * 本脚本:给 qc_proc_insp_detail 加 1 个整数列 `格数`,补中文注明,登记 yj_field + en 译名,
 *   并把存量行按老口径回填(尺寸/重量类 5 格,其余 1 格) —— 回填只认 NULL,幂等。
 *
 * 登记口径:hidden=1 / visible=0 —— 值要能存能取(loadDocs 取全部 detail 字段),
 *   但不进列表页明细列(列表列口径 = place 含 detail 且 visible=1 且 hidden=0)。
 *
 * 规范:列名中文即语义;幂等(COL_LENGTH 判空再 ADD);两账套均执行。
 */

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'格数') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 格数 int NULL;
GO

/* ============ B. 列级中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'格数', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'本检验项目在制程检验记录表横表里占几个录入格(1..5);定量项=测量值1..N,定性项=实测数值按 / 拆的 N 段',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'格数';
GO

/* ============ C. yj_field 登记(hidden=1/visible=0:不进列表列,但值照存照取) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'格数')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'格数', N'格数', N'整数', N'detail', 81, 60, 1, 0, 1, 0);
ELSE
  UPDATE yj_field SET data_type = N'整数', place = N'detail', seq = 81, width = 60, editable = 1
   WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'格数';
GO

/* ============ D. 多语言(新字段至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'格数' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'格数', N'en', N'Cells', N'manual');
GO

/* ============ E. 存量回填(只认 NULL) ============ */
UPDATE dbo.qc_proc_insp_detail
   SET 格数 = CASE WHEN 表区 LIKE N'%尺寸%' OR 表区 LIKE N'%重量%' THEN 5 ELSE 1 END
 WHERE 格数 IS NULL AND ISNULL(asp_cancel, 'N') <> 'Y';
GO

/* ============ F. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'格数') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'格数') <> 1 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'格数' AND locale = N'en') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'格数', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单格数列迁移自检失败', 16, 1);
ELSE PRINT N'制程检验单格数列就绪(格数 / 存量回填 / en 译名)';
GO
