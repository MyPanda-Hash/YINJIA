/* ============================================================================
 * migrate-sample-ext-attach-20261118.sql
 * 外部-开发样品申请单（RD_SAMPLE_EXT）新增「附件」字段
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-18，Excel #8）：
 *   「在期望交期页面后面做个位置，可以添加附件（图片或 PDF 或者 Word 文档）」
 *   并确认**只加在「外部-开发样品单」**（内部开发 / 非开发样品单都不加）。
 *
 * 落地：头表加一列 `附件`（nvarchar(500)，存文件名串，与产品信息表「客户图纸或规格书」同款）
 *   + yj_field 一行（data_type='附件'，place='header'，seq 紧跟在「期望交期」之后）。
 *   文件本体落 yj_attachment 表（通用组件 FileAttachCell 负责上传/预览/删除），
 *   锚点 = 面板码 + 单据编号 + 字段名，故这里只需保证**列与字段存在**。
 *
 * 幂等 / 两账套：加列带 COL_LENGTH 守卫，字段行带 NOT EXISTS，自检三态（缺表=提示跳过）。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_sample_ext_head') IS NULL
    PRINT N'[sample-ext-attach] 本库无 rd_sample_ext_head，跳过（schema 滞后）';
GO

/* ---------- ① 加列 ---------- */
IF OBJECT_ID('rd_sample_ext_head') IS NOT NULL AND COL_LENGTH('rd_sample_ext_head', N'附件') IS NULL
    ALTER TABLE rd_sample_ext_head ADD [附件] nvarchar(500) NULL;
GO

/* ---------- ② 中文注明（幂等） ---------- */
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
            WHERE t.name = 'rd_sample_ext_head' AND c.name = N'附件')
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
                    JOIN sys.tables t ON t.object_id = c.object_id
                    WHERE t.name = 'rd_sample_ext_head' AND c.name = N'附件' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'附件（文件名串；文件本体在 yj_attachment，锚点=面板+单据编号+附件）',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_sample_ext_head', N'COLUMN', N'附件';
GO

/* ---------- ③ yj_field 一行（以同面板「期望交期」为模板，seq 紧随其后） ---------- */
IF OBJECT_ID('rd_sample_ext_head') IS NOT NULL AND COL_LENGTH('rd_sample_ext_head', N'附件') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SAMPLE_EXT' AND label = N'附件')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
    SELECT N'RD_SAMPLE_EXT', N'附件', N'附件', N'附件', NULL, N'header',
           ISNULL((SELECT MAX(seq) FROM yj_field WHERE panel_code = 'RD_SAMPLE_EXT' AND place = N'header'), 0) + 1,
           120, 1, 0, 0, 1
      FROM (SELECT 1 AS x) t;
    PRINT N'[sample-ext-attach] 字段行就绪 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
ELSE PRINT N'[sample-ext-attach] 缺表/缺列，字段行跳过';
GO

/* ---------- ④ 自检 ---------- */
IF OBJECT_ID('rd_sample_ext_head') IS NOT NULL AND COL_LENGTH('rd_sample_ext_head', N'附件') IS NOT NULL
BEGIN
    DECLARE @bad int = 0;
    SELECT @bad = COUNT(*) FROM yj_field WHERE panel_code = 'RD_SAMPLE_EXT' AND label = N'附件' AND data_type = N'附件';
    IF @bad <> 1 RAISERROR(N'[sample-ext-attach] 自检失败：附件字段应为 1 行且 data_type=附件', 16, 1);

    -- 反向自检：其它两张样品单不该有这个字段（用户口径：只加外部-开发样品单）
    SELECT @bad = COUNT(*) FROM yj_field
     WHERE label = N'附件' AND panel_code IN ('RD_SAMPLE_INT', 'RD_SAMPLE_ND');
    IF @bad > 0 RAISERROR(N'[sample-ext-attach] 自检失败：内部/非开发样品单不应有附件字段', 16, 1);
    PRINT N'[sample-ext-attach] 自检通过';
END
GO
