/* migrate-qc-proc-insp-freq-col.sql(2026-10-13):制程检验单明细加「检查频率」列。
 *
 * 需求来源:用户 2026-10-13 截图《出货检验项目控制计划》(RD_INSP_PLAN,文档编号 YJ-RD001)。
 *   四个红框 = 产品编号 / 检验要求 / 检验方法 / 检查频率;口径「制程检验单按产品编码取到
 *   对应的检验内容进行填入」。
 *
 *   四个红框中:
 *     · 产品编号  = 关联键(制程检验单已有「产品编码」,不新增字段)
 *     · 检验要求  = 已有字段(映射 RD_INSP_PLAN.控制标准及要求)
 *     · 检验方法  = 已有字段(映射 RD_INSP_PLAN.控制方法)
 *     · 检查频率  = **缺失** —— 本脚本只补这一列(映射 RD_INSP_PLAN.检测频率)
 *
 * 取值与 RD_INSP_PLAN.检测频率 同源(下拉):1PCS/一个生产批次 · 生产量*1% · 型式检验。
 * 规范:列名中文即语义;仍补 MS_Description;幂等(COL_LENGTH 判空后 ADD);两账套均执行。
 */

/* ============ A. 加列 ============ */
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'检查频率') IS NULL
BEGIN
  ALTER TABLE dbo.qc_proc_insp_detail ADD 检查频率 nvarchar(50) NULL;
  PRINT N'[OK] qc_proc_insp_detail.检查频率 已加';
END
ELSE PRINT N'[SKIP] qc_proc_insp_detail.检查频率 已存在';
GO

/* ============ B. 列级中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'检查频率', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
    N'检查频率(来源=出货检验计划表 RD_INSP_PLAN.检测频率;取值 1PCS/一个生产批次 · 生产量*1% · 型式检验)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_proc_insp_detail', N'COLUMN', N'检查频率';
GO

/* ============ C. yj_field 登记(seq=52,夹在 检验方法50 / 检验仪器55 之间) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检查频率')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'检查频率', N'检查频率', N'下拉框',
          N'SELECT v FROM (VALUES (N''1PCS/一个生产批次''),(N''生产量*1%''),(N''型式检验'')) AS t(v)',
          N'detail', 52, 110, 1, 0, 0, 1);
GO

/* ============ D. 多语言(至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检查频率' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'检查频率', N'en', N'Inspection Frequency', N'manual');
GO

/* ============ E. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_detail', N'检查频率') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'检查频率'
                 AND data_type = N'下拉框' AND ISNULL(dict_sql, N'') <> N'') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_proc_insp_detail')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_proc_insp_detail'), N'检查频率', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检查频率' AND locale = N'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单「检查频率」列迁移自检失败', 16, 1);
ELSE PRINT N'制程检验单「检查频率」列就绪(列 + 注明 + yj_field + 字典 + en 译名)';
GO
