/* ============================================================================
 * migrate-finish-in-insp-link-20261112.sql
 *   产成品入库单(FINISH_IN)关联「出货检验功能记录表(QC_PROC_INSP)」与「出货检验表观(QC_ASM_INSP)」
 *
 * 【用户口径(2026-11-12)】
 *   「我的想法是修改当前的产成品入库，让他需要关联当前的出货检验功能记录表和出货检验表观，
 *     当这两个完成后按照每天的批次实现对这个产成品入库单的入库数量进行填写和创建。」
 *   + 追问确认:
 *     · 关联字段放**表头两个参照**(出货检验功能单号 / 出货检验表观单号);
 *     · 数量口径 = 按该工单行该批次号的已审核报工量合计自动带出,允许改;
 *     · 批次规则 = 两张单都必须已审核,且该批次在两张单里都判「合格」才可入库;
 *     · 粒度 = **一张产成品入库单对应一个日期批次**;
 *     · 创建方式 = 最后一道工序报工时自动生成草稿,或人工「选单(选生产工单)」创建以控制批次。
 *
 * 【本脚本(第 1 阶段:只落"关联字段",零业务代码依赖,先让单据能选/能存)】
 *   · bd_finish_in 加两列:出货检验功能单号 / 出货检验表观单号(nvarchar(60) NULL)+ 列 MS_Description;
 *   · yj_field 登记两条**参照**字段(place=header;ref_panel 分别 QC_PROC_INSP / QC_ASM_INSP;
 *     ref_field=display_field=单据编号 —— 与既有的「制程检验单号」(QC_BHG 参照 QC_PROC_INSP)同款);
 *   · yj_translation(scope='field')补 en/ja/ko/zh-TW/es/de/fr/ru/vi/th 十个语种(NOT EXISTS 守卫)。
 *   ⚠ 第 2 阶段(另开迁移/代码):保存/审核门禁(两单已审核 + 该批次双合格)、报工自动生成草稿、
 *     数量按批次报工量带出。本脚本只加字段,**不改任何既有单据数据/审批状态**。
 *
 * 幂等:两账套可重复执行。
 * ============================================================================ */

/* §1 加两列(判空) */
IF COL_LENGTH(N'dbo.bd_finish_in', N'出货检验功能单号') IS NULL
BEGIN
    ALTER TABLE dbo.bd_finish_in ADD 出货检验功能单号 nvarchar(60) NULL;
    PRINT N'[OK] bd_finish_in +出货检验功能单号';
END
ELSE PRINT N'[SKIP] bd_finish_in.出货检验功能单号 已存在';
IF COL_LENGTH(N'dbo.bd_finish_in', N'出货检验表观单号') IS NULL
BEGIN
    ALTER TABLE dbo.bd_finish_in ADD 出货检验表观单号 nvarchar(60) NULL;
    PRINT N'[OK] bd_finish_in +出货检验表观单号';
END
ELSE PRINT N'[SKIP] bd_finish_in.出货检验表观单号 已存在';
GO

/* §2 列注明 */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bd_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'出货检验功能单号', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'出货检验功能单号(关联 QC_PROC_INSP 出货检验单功能;2026-11-12 用户口径:产成品入库需关联功能/表观两张检验单,两单都已审核且该批次双合格才可入库。本阶段先落字段)',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'出货检验功能单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bd_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'出货检验表观单号', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'出货检验表观单号(关联 QC_ASM_INSP 出货检验表观;2026-11-12 用户口径:与出货检验功能单号成对,两单都已审核且该批次双合格才可入库。本阶段先落字段)',
        N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'出货检验表观单号';
PRINT N'[OK] 列注明已补齐';
GO

/* §3 yj_field 两条参照字段(header;已存在则只对齐属性) */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'出货检验功能单号')
BEGIN
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                              place, seq, width, editable, required, hidden, visible)
    VALUES (N'FINISH_IN', N'出货检验功能单号', N'出货检验功能单号', N'参照', N'QC_PROC_INSP', N'单据编号', N'单据编号',
            N'header', 66, 150, 1, 0, 0, 1);
    PRINT N'[OK] yj_field +出货检验功能单号';
END
ELSE PRINT N'[SKIP] yj_field.出货检验功能单号 已存在';
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'出货检验表观单号')
BEGIN
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                              place, seq, width, editable, required, hidden, visible)
    VALUES (N'FINISH_IN', N'出货检验表观单号', N'出货检验表观单号', N'参照', N'QC_ASM_INSP', N'单据编号', N'单据编号',
            N'header', 68, 150, 1, 0, 0, 1);
    PRINT N'[OK] yj_field +出货检验表观单号';
END
ELSE PRINT N'[SKIP] yj_field.出货检验表观单号 已存在';
GO

/* §4 译名(字段标签,10 语种;NOT EXISTS 守卫) */
DECLARE @labels TABLE (label nvarchar(60), en nvarchar(100), ja nvarchar(100), ko nvarchar(100), tw nvarchar(100),
                       es nvarchar(100), de nvarchar(100), fr nvarchar(100), ru nvarchar(100), vi nvarchar(100), th nvarchar(100));
INSERT INTO @labels VALUES
 (N'出货检验功能单号', N'Functional Inspection No.', N'出荷検査（機能）番号', N'출하 검사(기능) 번호', N'出貨檢驗功能單號',
  N'N.º inspección salida (funcional)', N'Ausgangsprüfung (funktional) Nr.', N'N° inspection sortante (fonctionnelle)',
  N'№ исходящего контроля (функц.)', N'Số phiếu kiểm tra xuất (chức năng)', N'เลขที่ตรวจสอบขาออก (เชิงหน้าที่)'),
 (N'出货检验表观单号', N'Appearance Inspection No.', N'出荷検査（外観）番号', N'출하 검사(외관) 번호', N'出貨檢驗表觀單號',
  N'N.º inspección salida (apariencia)', N'Ausgangsprüfung (optisch) Nr.', N'N° inspection sortante (aspect)',
  N'№ исходящего контроля (внешн.)', N'Số phiếu kiểm tra xuất (ngoại quan)', N'เลขที่ตรวจสอบขาออก (ลักษณะภายนอก)');
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
PRINT N'[OK] 译名已补(10 语种)';
GO

/* §5 自检 */
IF COL_LENGTH(N'dbo.bd_finish_in', N'出货检验功能单号') IS NULL OR COL_LENGTH(N'dbo.bd_finish_in', N'出货检验表观单号') IS NULL
    RAISERROR(N'[FAIL] bd_finish_in 两个关联列未齐全', 16, 1);
IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label IN (N'出货检验功能单号', N'出货检验表观单号')) <> 2
    RAISERROR(N'[FAIL] yj_field 关联字段不是 2 行', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label IN (N'出货检验功能单号', N'出货检验表观单号')
            AND (data_type <> N'参照' OR ref_field <> N'单据编号' OR display_field <> N'单据编号' OR place <> N'header'))
    RAISERROR(N'[FAIL] 关联字段属性不符(参照/单据编号/header)', 16, 1);
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key IN (N'出货检验功能单号', N'出货检验表观单号') AND locale IN (N'en',N'ja',N'ko',N'zh-TW',N'es',N'de',N'fr',N'ru',N'vi',N'th')) < 10
    RAISERROR(N'[FAIL] 关联字段译名不足 10 语种', 16, 1);
PRINT N'[OK] 自检通过:两列 + 两个参照字段 + 10 语种译名';
GO
