/* ============================================================================
 * migrate-qc-docs-twolevel-20261118.sql —— 质量单据其余 6 张:与紧急放行单同款改造
 *                                            (责任部门=责任人所属部门 / 物料编码手输 /
 *                                             责任人·日期自动生成 / 可附图片章节挂附件)
 * ----------------------------------------------------------------------------
 * 用户 2026-11-18 口径:
 *   ①「质量单据列的其余表单都是一样的模式进行改动,二级审批实现即可,不需要指定某个审批人」
 *     (质量单据 = 不合格报告(制程) / 不合格品处理单(制程) / 不合格品处理单(自制物料) /
 *      紧急放行申请单(11-17 已改) / 试产材料使用申请单 / 来料异常分析报告 / 生产异常分析报告)
 *     追问确认:只做「基础同款」;「责任部门」取**责任人(建单/提交人)所属部门**(动态)。
 *   ③「当前的单据中存在提及可附图片的单据,需要为当前这个地方增加上传附件的组件」
 *
 * 逐条落地:
 *   A. 责任部门 = 责任人所属部门(2026-11-18 用户选 B「改成责任人所属部门(动态)」)
 *      ⇒ 5 张单头表补 [责任部门] 列 + yj_field(只读),后端
 *        ButtonService.RESP_DEPT_PANELS / putRespDept / prefillRespDept / syncRespDeptToSubmitter
 *        按建单人·提交人所属部门(yj_user.dept_id → yj_dept.dept_name)写入。
 *      ⚠ 不含 QC_BHG(不合格报告·制程):它的「责任部门」是**表头录入的业务值**(问题责任部门),
 *        不是"谁填单的部门",而且右上信息表印的是「填写部门/填写人/填写日期」,口径不同,刻意不动。
 *
 *   B. 物料编码 = 责任人手动录入(去掉「点击选择」参照)
 *      ⇒ QC_BHC.产品编码 / QC_BHZ.物料编码 / QC_SCP.物料编码 / QC_LYB.物料编码 /
 *        QC_SCY.产品物料编码:data_type 参照 → 文本,参照源全清。
 *      (QC_BHG 没有编码列;紧急放行单 11-17 已改)
 *
 *   C. 「责任人 / 日期」自动生成:日期段 = 单据日期(建单即当天)
 *      ⇒ 这 6 张单的 单据日期 yj_field.editable 1 → 0(纸面只读,值由单据引擎建单时写当天);
 *        纸面各章节签名行的「日期」由 docSheetConfigs 配 dateKey='单据日期'(见前端)。
 *        责任人/填写人/编制人:维持各单既有口径(BHC/BHZ/SCP=责任人预填可改;
 *        BHG=填写人、LYB/SCY=编制人 由 ButtonService 建单预填创建人、提交审批刷成提交人)。
 *
 *   D. 「可附图片」章节挂上传附件组件(复用 FileAttachCell + /api/attachment)
 *      ⇒ QC_BHC / QC_BHZ / QC_SCP / QC_LYB 单头补 [附件] nvarchar(500) + yj_field(data_type=附件,
 *        hidden=1:不出列表/表头格,只由纸面章节内的上传组件写入与展示)。
 *        锚点 = panel_code + 单据编号 + field_key「附件」(AttachmentService 的表头附件口径)。
 *
 * 幂等:全部 IF NOT EXISTS / 带旧值守卫;末尾自检不符即 RAISERROR。
 * 两账套都要执行(HSDZ_MES / HSDZ_MES_TEST)。新增列写 MS_Description(AGENTS.md 硬要求)。
 * ========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ── A. 责任部门列(5 张单;QC_BHG 刻意不含) ───────────────────────────── */
DECLARE @deptTbl TABLE (tbl sysname);
INSERT INTO @deptTbl VALUES (N'qc_bhc'), (N'qc_bhz'), (N'qc_scp'), (N'qc_lyb'), (N'qc_scy');

DECLARE @t sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @deptTbl;
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(@t, N'责任部门') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [' + @t + N'] ADD [责任部门] nvarchar(100) NULL;';
        EXEC sp_executesql @sql;
        PRINT N'[qc-docs] ' + @t + N'.责任部门 added';
    END
    ELSE PRINT N'[qc-docs] ' + @t + N'.责任部门 exists, skip';

    -- 列级中文注明(幂等:先删后加)
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(@t)
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(@t), N'责任部门', 'ColumnId')
                 AND name = N'MS_Description')
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'责任部门';
    EXEC sp_addextendedproperty N'MS_Description',
         N'责任部门：= 责任人（建单人/提交审批的人）所属部门，由后端按 yj_user.dept_id → yj_dept.dept_name 自动写入，纸面只读（2026-11-18 质量单据同款改造）。',
         N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', N'责任部门';

    -- yj_field 登记(只读;seq 182 紧跟 责任人/编制人)
    DECLARE @panel varchar(40) = CASE @t
        WHEN N'qc_bhc' THEN 'QC_BHC' WHEN N'qc_bhz' THEN 'QC_BHZ' WHEN N'qc_scp' THEN 'QC_SCP'
        WHEN N'qc_lyb' THEN 'QC_LYB' WHEN N'qc_scy' THEN 'QC_SCY' END;
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'责任部门')
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width,
                              editable, required, hidden, visible)
        VALUES (@panel, N'责任部门', N'责任部门', N'文本', N'header', 182, 120, 0, 0, 0, 1);
    ELSE
        UPDATE yj_field SET col_name = N'责任部门', data_type = N'文本', place = N'header',
                            editable = 0, required = 0, hidden = 0, visible = 1
         WHERE panel_code = @panel AND label = N'责任部门';

    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[qc-docs] 责任部门 列/字段 就绪(5 张)';
GO

/* ── B. 编码列:参照 → 纯文本手输 ──────────────────────────────────────── */
DECLARE @ref TABLE (panel varchar(40), lbl nvarchar(60));
INSERT INTO @ref VALUES (N'QC_BHC', N'产品编码'), (N'QC_BHZ', N'物料编码'), (N'QC_SCP', N'物料编码'),
                        (N'QC_LYB', N'物料编码'), (N'QC_SCY', N'产品/物料编码');
UPDATE yj_field
   SET data_type = N'文本', ref_panel = NULL, ref_field = NULL, display_field = NULL
 WHERE (panel_code + N'|' + label) IN (SELECT panel + N'|' + lbl FROM @ref)
   AND (data_type <> N'文本' OR ref_panel IS NOT NULL OR ref_field IS NOT NULL);
PRINT N'[qc-docs] 编码列 → 文本(手输),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── C. 单据日期只读(建单即当天,纸面「日期」自动生成) ───────────────── */
UPDATE yj_field
   SET editable = 0
 WHERE panel_code IN (N'QC_BHG', N'QC_BHC', N'QC_BHZ', N'QC_SCP', N'QC_LYB', N'QC_SCY')
   AND label = N'单据日期' AND editable = 1;
PRINT N'[qc-docs] 单据日期 → 只读,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ── D. 「可附图片」章节:单头补 [附件] 列 + 登记附件字段 ───────────────── */
DECLARE @att TABLE (tbl sysname, panel varchar(40));
INSERT INTO @att VALUES (N'qc_bhc', N'QC_BHC'), (N'qc_bhz', N'QC_BHZ'),
                        (N'qc_scp', N'QC_SCP'), (N'qc_lyb', N'QC_LYB');

DECLARE @at sysname, @ap varchar(40), @asql nvarchar(max);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, panel FROM @att;
OPEN cur2;
FETCH NEXT FROM cur2 INTO @at, @ap;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(@at, N'附件') IS NULL
    BEGIN
        SET @asql = N'ALTER TABLE [' + @at + N'] ADD [附件] nvarchar(500) NULL;';
        EXEC sp_executesql @asql;
        PRINT N'[qc-docs] ' + @at + N'.附件 added';
    END
    ELSE PRINT N'[qc-docs] ' + @at + N'.附件 exists, skip';

    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(@at)
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(@at), N'附件', 'ColumnId')
                 AND name = N'MS_Description')
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @at, N'COLUMN', N'附件';
    EXEC sp_addextendedproperty N'MS_Description',
         N'附件：纸面「可附图片」章节里上传的图片/文件（原文件名列表，、分隔）。文件本体在 yj_attachment，锚点=面板+单据编号+本列。',
         N'SCHEMA', N'dbo', N'TABLE', @at, N'COLUMN', N'附件';

    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @ap AND label = N'附件')
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width,
                              editable, required, hidden, visible)
        VALUES (@ap, N'附件', N'附件', N'附件', N'header', 990, 160, 0, 0, 1, 1);
    ELSE
        UPDATE yj_field SET col_name = N'附件', data_type = N'附件', place = N'header',
                            editable = 0, required = 0, hidden = 1, visible = 1
         WHERE panel_code = @ap AND label = N'附件';

    FETCH NEXT FROM cur2 INTO @at, @ap;
END
CLOSE cur2; DEALLOCATE cur2;
PRINT N'[qc-docs] 附件 列/字段 就绪(4 张)';
GO

/* ── 自检 ─────────────────────────────────────────────────────────────── */
IF EXISTS (SELECT 1 FROM (VALUES (N'qc_bhc'),(N'qc_bhz'),(N'qc_scp'),(N'qc_lyb'),(N'qc_scy')) v(t)
           WHERE COL_LENGTH(v.t, N'责任部门') IS NULL)
    RAISERROR(N'责任部门 列未在 5 张单上补齐', 16, 1);
IF EXISTS (SELECT 1 FROM (VALUES (N'qc_bhc'),(N'qc_bhz'),(N'qc_scp'),(N'qc_lyb')) v(t)
           WHERE COL_LENGTH(v.t, N'附件') IS NULL)
    RAISERROR(N'附件 列未在 4 张「可附图片」单上补齐', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE (panel_code + N'|' + label) IN
             (N'QC_BHC|产品编码', N'QC_BHZ|物料编码', N'QC_SCP|物料编码',
              N'QC_LYB|物料编码', N'QC_SCY|产品/物料编码')
           AND (data_type <> N'文本' OR ref_panel IS NOT NULL))
    RAISERROR(N'编码列未改成「文本手输」(参照源应全清)', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code IN (N'QC_BHG',N'QC_BHC',N'QC_BHZ',N'QC_SCP',N'QC_LYB',N'QC_SCY')
             AND label = N'单据日期' AND editable = 1)
    RAISERROR(N'单据日期 仍可编辑(应为自动生成、纸面只读)', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE label = N'责任部门' AND panel_code IN (N'QC_BHC',N'QC_BHZ',N'QC_SCP',N'QC_LYB',N'QC_SCY')) <> 5
    RAISERROR(N'责任部门 字段登记不是 5 行', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE label = N'附件' AND panel_code IN (N'QC_BHC',N'QC_BHZ',N'QC_SCP',N'QC_LYB')) <> 4
    RAISERROR(N'附件 字段登记不是 4 行', 16, 1);
PRINT N'[qc-docs] 自检通过';
GO
