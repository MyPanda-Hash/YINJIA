/* migrate-qc-proc-insp-wo-line-field.sql(2026-10-15):把制程检验单的「工单行号」登记进 yj_field。
 *
 * 背景:用户口径「选择生产工单加工单行号唯一确定当前的生产工单」—— 制程检验单要能按
 *   生产工单行(plang.pl_no + plang.pl_xc)创建,表头必须带工单行号。
 *
 * ⚠ 本脚本**不建列**:qc_proc_insp_head.[工单行号] **物理列早已存在**(COL_LENGTH=4),
 *   但从建表起就**没有登记进 yj_field** ⇒ 引擎保存是「label → 物理列」映射,
 *   未登记的 label 会被**静默丢弃**,于是表头永远没有工单行号(实测该列全空)。
 *   本脚本只补登记 + 译名。
 *
 * 幂等:按 (panel_code, col_name) 判存在;两账套均执行。
 */

/* ============ A. yj_field 登记(seq=35,镜像 QC_MOLD_INSP 同名字段配置) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'工单行号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_PROC_INSP', N'工单行号', N'工单行号', N'整数', N'query,header', 35, 80, 0, 0, 0, 1);
GO

/* ============ B. 多语言(至少 en) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单行号' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'工单行号', N'en', N'Work Order Line No.', N'manual');
GO

/* ============ C. 自检 ============ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_proc_insp_head', N'工单行号') IS NULL SET @bad = @bad + 1;   -- 物理列必须已存在
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'工单行号'
                 AND data_type = N'整数' AND place LIKE N'%header%' AND visible = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'工单行号' AND locale = N'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单「工单行号」字段登记自检失败', 16, 1);
ELSE PRINT N'制程检验单「工单行号」字段就绪(yj_field + en 译名;物理列原已存在)';
GO
