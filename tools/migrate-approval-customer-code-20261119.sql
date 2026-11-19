/* ============================================================================
 * migrate-approval-customer-code-20261119.sql
 * 立项申请表（RD_APPROVAL）：选客户后同时带出并显示「客户编号」
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-19）：「立项申请表选取客户之后要显示客户名称和客户编号」。
 *   现状：客户名是 KHDA 参照（ref_field=mc），选完只显示名称；编号只在内部用于生成文档编号。
 *   做法：头表加 `客户编号` 列 + yj_field 一行（place=header，不单独占纸面格子，
 *        由 DocSheet 在「客户名」那格后面以灰色小字显示）；选中客户时由 applyApprovalDocNo
 *        一并写入（同一份 source 里已能取到编码，见该函数 CODE_KEYS）。
 *
 * 幂等 / 两账套：加列带 COL_LENGTH 守卫，字段行带 NOT EXISTS，缺表三态跳过。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('rd_approval') IS NULL
    PRINT N'[approval-cust-code] 本库无 rd_approval，跳过（schema 滞后）';
GO

IF OBJECT_ID('rd_approval') IS NOT NULL AND COL_LENGTH('rd_approval', N'客户编号') IS NULL
    ALTER TABLE rd_approval ADD [客户编号] nvarchar(100) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
            WHERE t.name = 'rd_approval' AND c.name = N'客户编号')
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
                    JOIN sys.tables t ON t.object_id = c.object_id
                    WHERE t.name = 'rd_approval' AND c.name = N'客户编号' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户编号（选客户时由客户档案 dm 带出，纸面显示在客户名后）',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_approval', N'COLUMN', N'客户编号';
GO

IF OBJECT_ID('rd_approval') IS NOT NULL AND COL_LENGTH('rd_approval', N'客户编号') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND label = N'客户编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    SELECT N'RD_APPROVAL', N'客户编号', N'客户编号', N'文本', N'header',
           ISNULL((SELECT MAX(seq) FROM yj_field WHERE panel_code='RD_APPROVAL'), 0) + 1, 120, 1, 0, 0, 1;
    PRINT N'[approval-cust-code] 字段行就绪 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
ELSE PRINT N'[approval-cust-code] 缺表/缺列，字段行跳过';
GO

IF OBJECT_ID('rd_approval') IS NOT NULL AND COL_LENGTH('rd_approval', N'客户编号') IS NOT NULL
BEGIN
    IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_APPROVAL' AND label=N'客户编号') <> 1
        RAISERROR(N'[approval-cust-code] 自检失败：客户编号字段应为 1 行', 16, 1);
    PRINT N'[approval-cust-code] 自检通过';
END
GO
