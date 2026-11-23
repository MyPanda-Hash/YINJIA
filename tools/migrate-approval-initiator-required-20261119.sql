/* ============================================================================
 * migrate-approval-initiator-required-20261119.sql
 * 立项申请：「申请立项人」改为必填（销售问题汇总 P18 的口径配套）
 * 用户口径：「显示申请立项人字段（业务填写人），且该字段应改成必填」。
 * 只改 yj_field.required；不留 NULL 兜底（历史空值不在本脚本造数）。
 * ========================================================================== */
SET NOCOUNT ON;
UPDATE yj_field SET required = 1
 WHERE panel_code = N'RD_APPROVAL' AND label = N'申请立项人' AND ISNULL(required,0) <> 1;
PRINT N'[approval-initiator-required] 置必填行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'RD_APPROVAL' AND label=N'申请立项人' AND required=1)
    RAISERROR(N'[approval-initiator-required] 自检失败：申请立项人未置为必填', 16, 1);
PRINT N'[approval-initiator-required] 自检通过';
GO
