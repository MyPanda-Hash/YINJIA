/* migrate-qc-proc-insp-measure-cols.sql(2026-10-12):制程检验单明细加「测量值1..5」等录入列。
 *
 * 用户 2026-10-12 口径(截图1《生产相关品质检验.xlsx》制程检验页签):
 *   「这个图片形式是当前针对这个制程检验单的进行实现而不是当前这个,报表创建死数据填充进去,
 *     要求实现的是针对这个报表格式完成对当前制程检验单的字段和明细表的完成」
 *   ⇒ 制程检验单**面板本身**要能像截图那样录入(外观/尺寸/出货重量 各有录入格),
 *     报表再从这些真实数据出 —— 而不是把值写死在模板里。
 *
 * 关键缺口(截图1):「尺寸」「出货重量」各有 **5 个测量值格**(对应抽检量 5),
 *   而原明细只有 1 个「实测数值」文本列(把 5 个值挤成一串)。
 *
 * 本脚本:给 qc_proc_insp_detail 加 5 个数值列(测量值1..5)+ 3 个辅助列,并登记 yj_field。
 *   保留原「实测数值」文本列不动(其他面板/历史数据仍用它);
 *   新增列由报表优先读取,取不到再回退到「实测数值」。
 *
 * 规范:列名中文即语义(免注明)、审计列齐备;幂等(COL_LENGTH 判空再 ADD);两账套均执行。
 */

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值1') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值1 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值2') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值2 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值3') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值3 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值4') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值4 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值5') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 测量值5 decimal(18,4) NULL;
GO
/* 辅助列:与截图1 表头/表体对齐 */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'检验仪器') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 检验仪器 nvarchar(100) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'不良数量') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 不良数量 decimal(18,4) NULL;
GO
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'备注2') IS NULL
  ALTER TABLE dbo.qc_proc_insp_detail ADD 备注2 nvarchar(200) NULL;
GO

/* ============ B. 列级中文注明(新列全部补) ============ */
DECLARE @cols TABLE (col sysname, note nvarchar(300));
INSERT INTO @cols VALUES
 (N'测量值1', N'实测值第1个(尺寸/重量类项目对应抽检量的第1个测量值)'),
 (N'测量值2', N'实测值第2个'),
 (N'测量值3', N'实测值第3个'),
 (N'测量值4', N'实测值第4个'),
 (N'测量值5', N'实测值第5个'),
 (N'检验仪器', N'截图「检验仪器/方法」列(与已有的 检验方法 同义,按截图分列展示)'),
 (N'不良数量', N'截图「不良数量」列'),
 (N'备注2', N'行级备注补充(备注 已用于其他面板共用列,故另开一列按截图展示)');
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

/* ============ C. yj_field 登记(字段名中文,place=detail) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fd VALUES
 (N'测量值1',  75,  80, 1, 0, N'小数'),
 (N'测量值2',  76,  80, 1, 0, N'小数'),
 (N'测量值3',  77,  80, 1, 0, N'小数'),
 (N'测量值4',  78,  80, 1, 0, N'小数'),
 (N'测量值5',  79,  80, 1, 0, N'小数'),
 (N'检验仪器', 55, 120, 1, 0, N'文本'),
 (N'不良数量', 95,  90, 1, 0, N'小数'),
 (N'备注2',   125, 160, 1, 0, N'文本');
DECLARE @c2 nvarchar(50), @s int, @w int, @e int, @r int, @t nvarchar(20);
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required, dtype FROM @fd;
OPEN curf FETCH NEXT FROM curf INTO @c2, @s, @w, @e, @r, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_PROC_INSP', @c2, @c2, @t, N'detail', @s, @w, @e, @r, 0, 1);
  ELSE
    UPDATE yj_field SET data_type = @t, seq = @s, width = @w
     WHERE panel_code = N'QC_PROC_INSP' AND col_name = @c2;
  FETCH NEXT FROM curf INTO @c2, @s, @w, @e, @r, @t;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ D. 多语言(新字段至少 en) ============ */
DECLARE @ft TABLE (label nvarchar(50), en nvarchar(100));
INSERT INTO @ft VALUES
 (N'测量值1', N'Measured 1'), (N'测量值2', N'Measured 2'), (N'测量值3', N'Measured 3'),
 (N'测量值4', N'Measured 4'), (N'测量值5', N'Measured 5'),
 (N'检验仪器', N'Instrument'), (N'不良数量', N'Defect Qty'), (N'备注2', N'Remark 2');
DECLARE @lb nvarchar(50), @en nvarchar(100);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT label, en FROM @ft;
OPEN curt FETCH NEXT FROM curt INTO @lb, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @lb AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', @lb, N'en', @en, N'manual');
  ELSE
    UPDATE yj_translation SET text = @en
     WHERE scope = N'field' AND ref_key = @lb AND locale = N'en' AND text = @lb;
  FETCH NEXT FROM curt INTO @lb, @en;
END
CLOSE curt DEALLOCATE curt;
GO

/* ============ E. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值1') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'测量值5') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'检验仪器') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'不良数量') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name LIKE N'测量值%') < 5 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'测量值1', 'ColumnId')
      AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单测量值列迁移自检失败', 16, 1);
ELSE PRINT N'制程检验单测量值列就绪(测量值1..5 / 检验仪器 / 不良数量 / 备注2)';
GO
