/* migrate-qc-proc-insp-measure10.sql(2026-10-16):制程检验单明细「测量值」列 5 → 10 个。
 *
 * 用户 2026-10-16 口径:
 *   「让当前的检验单据能够实现对需要几个数据量填写就有几个数据列的形式实现,并且当前的数据要能够
 *     实际保存在数据库,当前就预设10个测量数据列,当不使用到数据列的情况下就不激活当前的数据列,
 *     让当前的检验项目可以选择多少个数据列」。
 *
 * ⇒ 口径落点:**物理列预置 10 个**(测量值1..10,值真落库),界面只渲染本条明细「格数」用到的前 N 格
 *   (未用到的格既不渲染也不激活)⇒ 每个检验项目自己选要几格(列头 −/＋,范围 1..10)。
 *
 * 本脚本:
 *   A. 加物理列 测量值6..10 decimal(18,4)(镜像 测量值1..5,幂等 COL_LENGTH 判空);
 *   B. 列级中文注明(实测值第 6..10 个);
 *   C. yj_field 登记(seq 82..86,width 80,小数,place=detail,可见性镜像 1..5);
 *   D. 多语言(至少 en:Measured 6..10);
 *   E. 把 格数 的列注明从 (1..5) 更正为 (1..10);
 *   F. 自检。
 *
 * ⚠ 前置:migrate-qc-proc-insp-cell-count.sql(格数列)与 migrate-qc-proc-insp-measure-cols.sql
 *   (测量值1..5)必须先跑过 —— 本脚本只做「5 → 10」的增量;缺前置时自检会报错,请先跑前置。
 *
 * 规范:列名中文即语义;幂等;两账套均执行。
 */

/* ============ A. 加列(测量值6..10) ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值6') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值6 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值7') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值7 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值8') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值8 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值9') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值9 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值10') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值10 decimal(18,4) NULL;
GO

/* ============ B. 列级中文注明(测量值6..10) ============ */
DECLARE @cols TABLE (col sysname, note nvarchar(300));
INSERT INTO @cols VALUES
 (N'测量值6',  N'实测值第6个(尺寸/重量类项目对应抽检量的第6个测量值)'),
 (N'测量值7',  N'实测值第7个'),
 (N'测量值8',  N'实测值第8个'),
 (N'测量值9',  N'实测值第9个'),
 (N'测量值10', N'实测值第10个');
DECLARE @c sysname, @n nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @cols;
OPEN cur FETCH NEXT FROM cur INTO @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                  WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                    AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), @c, 'ColumnId')
                    AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo',
         N'TABLE', N'qc_proc_insp_detail', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @n;
END
CLOSE cur DEALLOCATE cur;
GO

/* ============ C. yj_field 登记(镜像 测量值1..5:小数 / detail / 可见) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int);
INSERT INTO @fd VALUES
 (N'测量值6',  82, 80),
 (N'测量值7',  83, 80),
 (N'测量值8',  84, 80),
 (N'测量值9',  85, 80),
 (N'测量值10', 86, 80);
DECLARE @c2 nvarchar(50), @s int, @w int;
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width FROM @fd;
OPEN curf FETCH NEXT FROM curf INTO @c2, @s, @w;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_PROC_INSP', @c2, @c2, N'小数', N'detail', @s, @w, 1, 0, 0, 1);
  ELSE
    UPDATE yj_field SET data_type = N'小数', place = N'detail', seq = @s, width = @w, editable = 1
     WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c2;
  FETCH NEXT FROM curf INTO @c2, @s, @w;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ D. 多语言(至少 en) ============ */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(100));
INSERT INTO @ft VALUES
 (N'测量值6', N'Measured 6'), (N'测量值7', N'Measured 7'), (N'测量值8', N'Measured 8'),
 (N'测量值9', N'Measured 9'), (N'测量值10', N'Measured 10');
DECLARE @lb nvarchar(50), @en nvarchar(100);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curt FETCH NEXT FROM curt INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @lb AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', @lb, N'en', @en, N'manual');
  FETCH NEXT FROM curt INTO @lb, @en;
END
CLOSE curt DEALLOCATE curt;
GO

/* ============ E. 「格数」列注明:1..5 → 1..10 ============ */
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'格数', 'ColumnId')
              AND name = N'MS_Description' AND class = 1)
  EXEC sp_updateextendedproperty N'MS_Description',
       N'本检验项目在制程检验记录表横表里占几个录入格(1..10);定量项=测量值1..N,定性项=实测数值按 / 拆的 N 段',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'格数';
GO

/* ============ F. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值6') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值10') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name LIKE N'测量值%') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key LIKE N'测量值%' AND locale = N'en') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'测量值10', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
/* 前置检查:格数列必须已在(否则「选几格」无处落库) */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'格数') IS NULL SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单测量值 10 列迁移自检失败(检查前置:格数列/测量值1..5)', 16, 1);
ELSE PRINT N'制程检验单测量值列就绪(测量值1..10,界面按 格数 1..10 只激活用到的格)';
GO
