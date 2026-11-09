/* ============================================================================
   migrate-lab-mobile-20261109.sql
   ── 实验室记录手机登记:三张记录表补「手机照片」附件列 ──────────────────────
   ============================================================================
   【用户口径 2026-11-09】
     「研发图片上的 3 个面版也要对应的做手机端,在手机扫码下面,叫实验室记录手机登记。
       手机端只需要实现,可以拍照上传和可以填写对应字段的内容就可以。再要一个模糊查询。
       还有数据要可以对应回填各自的面版,还有原来每个面版要增加一个字段,
       来保存手机拍照上传的文件。」

   3 个面板(研发管理 → 测试记录 → 实验室使用记录表 下的记录类三张):
     · 加标水配置记录表  RD_SPIKE_WATER  (rd_spike_water_head / _detail,前缀 SW)
     · 设备使用登记表    RD_EQUIP_USE    (rd_equip_use_head   / _detail,前缀 EU)
     · 仪器使用记录表    RD_INSTR_USE    (rd_instr_use_head   / _detail,前缀 IU)
   (「测试申请单 RD_DOM_TEST」不在本次范围:它是三页签的申请单据,不是使用记录。)

   【本脚本只做一件事:给每张**单据头表**加一列 [手机照片]】
     · 手机端拍完照走既有附件服务 /api/attachment/upload 落盘 + 落 yj_attachment,
       并把**原文件名串**同步写回本列(AttachmentService.syncHeadField)⇒
       电脑端列表/表单/打印看到的就是这串文件名,点开即预览(附件是元数据驱动)。
     · 为什么要真列而不是只靠 yj_attachment:电脑端 FileAttachCell 靠 yj_field 里的
       data_type='附件' 字段发现锚点(见 frontend/src/core/panel/attachField.js、
       PanelxList 的 attach-strip),没有登记字段就**没有入口**(附件存了也看不见)。
     · 数据键(列名/字段 label)一律中文,不随语言变化(ADR-0001)。

   【幂等】列/字段/译名全部按「存在即跳过」写;重复执行不报错、不重复插行。
   两个账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ── ① 三张头表补列 [手机照片] nvarchar(500)(与头表其它 500 宽附件列同口径)── */
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_spike_water_head ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-20261109.sql:已加列 rd_spike_water_head.手机照片';
END
ELSE PRINT N'migrate-lab-mobile-20261109.sql:列 rd_spike_water_head.手机照片 已存在';
GO
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_equip_use_head ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-20261109.sql:已加列 rd_equip_use_head.手机照片';
END
ELSE PRINT N'migrate-lab-mobile-20261109.sql:列 rd_equip_use_head.手机照片 已存在';
GO
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NULL
BEGIN
    ALTER TABLE rd_instr_use_head ADD [手机照片] nvarchar(500) NULL;
    PRINT N'migrate-lab-mobile-20261109.sql:已加列 rd_instr_use_head.手机照片';
END
ELSE PRINT N'migrate-lab-mobile-20261109.sql:列 rd_instr_use_head.手机照片 已存在';
GO

/* ── ② 中文列注明(全量部署规范:新增列必须带 MS_Description,幂等写法)── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_spike_water_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_spike_water_head'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:实验室记录手机登记拍/选的照片,存于 yj_attachment(锚点=面板+单据编号+本字段),此列同步原文件名串(、分隔)供列表/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_spike_water_head', N'COLUMN', N'手机照片';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_equip_use_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_equip_use_head'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:实验室记录手机登记拍/选的照片,存于 yj_attachment(锚点=面板+单据编号+本字段),此列同步原文件名串(、分隔)供列表/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_equip_use_head', N'COLUMN', N'手机照片';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_instr_use_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_instr_use_head'), '手机照片', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'手机照片:实验室记录手机登记拍/选的照片,存于 yj_attachment(锚点=面板+单据编号+本字段),此列同步原文件名串(、分隔)供列表/打印显示',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_instr_use_head', N'COLUMN', N'手机照片';
GO

/* ── ③ 三个面板各登记一个「手机照片」字段(data_type='附件' = 电脑端附件入口)──
   place='header':它是单据头字段(一单一组照片),不是明细列;
   seq=50:现有 header 最大 seq=40(备注),照片排在备注之后;
   editable=1/required=0:电脑端也能补传,但不强制。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SPIKE_WATER' AND col_name = N'手机照片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SPIKE_WATER', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'header', 50, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_EQUIP_USE' AND col_name = N'手机照片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_EQUIP_USE', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'header', 50, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_INSTR_USE' AND col_name = N'手机照片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_INSTR_USE', N'手机照片', N'手机照片', N'附件', NULL, NULL, NULL,
            NULL, N'header', 50, 200, 1, 0, 0, 1);
GO

/* ── ④ 译名(AGENTS 多语言红线:新字段必须带 en;其余语言走机翻兜底)── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'手机照片' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'手机照片', 'en', N'Mobile Photo', 'manual');
GO

/* ── ⑤ 校验 ────────────────────────────────────────────────────────────── */
DECLARE @miss INT = 0;
IF COL_LENGTH('rd_spike_water_head', '手机照片') IS NULL SET @miss += 1;
IF COL_LENGTH('rd_equip_use_head', '手机照片') IS NULL SET @miss += 1;
IF COL_LENGTH('rd_instr_use_head', '手机照片') IS NULL SET @miss += 1;
IF (SELECT COUNT(*) FROM yj_field WHERE col_name = N'手机照片' AND data_type = N'附件'
      AND panel_code IN ('RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE')) <> 3 SET @miss += 10;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'手机照片' AND locale = 'en')
    SET @miss += 100;
IF @miss = 0
    PRINT N'[PASS] migrate-lab-mobile-20261109:3 张头表列 + 3 条 yj_field + 译名 全部就位';
ELSE
    RAISERROR(N'[FAIL] migrate-lab-mobile-20261109:自检 miss=%d (1..3=缺列, +10=yj_field 数不对, +100=缺译名)', 16, 1, @miss);
GO
