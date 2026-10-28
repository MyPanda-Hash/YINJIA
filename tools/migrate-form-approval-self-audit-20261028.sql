/* =============================================================================
   migrate-form-approval-self-audit-20261028.sql
   -----------------------------------------------------------------------------
   目的：给审批留痕表 yj_form_approval 增加「自审」标记（2026-10-28 用户口径：
     「本人可以提出审核后自己审核确认，增加一个这个权限设置，保留原来的
       本人提交审核后不能本人自己审核的逻辑」）。

   为什么要一列：编制与审批分离是内控口径（2026-09-12 起）。放开一个「本人自审」
   权限之后，**审批情况里必须一眼看得出这条通过是自审**——否则事后查账时
   「编制人 = 审批人」的单据与正常单据长得一样，等于把留痕抹平。
   不复用 opinion：意见是审批人手写的业务文字，把「自审」前缀塞进去会被当成用户意见。
   不改 action（仍是 APPROVE）：yj_form_approval.action 有下游在按值判流程
   （requirePendingSubmission / flowStages 等），新造 action='APPROVE_SELF' 会牵动一串判据。

   列：self_audit char(1) NULL —— 'Y' = 本次通过是**提交人自审**；NULL/'N' = 正常他人审批。
   幂等：列不存在才加；扩展属性先查后加。两账套都要执行（先 HSDZ_MES 后 HSDZ_MES_TEST）。
   ============================================================================= */

SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.yj_form_approval', 'self_audit') IS NULL
    ALTER TABLE dbo.yj_form_approval ADD self_audit char(1) NULL;
GO

/* 中文注明（扩展属性；缺注即视为未完成，规范见 docs/development/数据库规范.md） */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.yj_form_approval') AND minor_id = 0
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'单据审批留痕（提交/通过/驳回/直审/弃审/会签…），一张单据多条记录，按时间排序',
         'SCHEMA', N'dbo', 'TABLE', N'yj_form_approval';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.yj_form_approval')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.yj_form_approval'), 'self_audit', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'自审标记：Y=本次审批通过由提交人本人完成（已授予「本人自审」权限）；NULL/N=正常他人审批',
         'SCHEMA', N'dbo', 'TABLE', N'yj_form_approval', 'COLUMN', N'self_audit';
GO

/* 自检：列必须在、类型 char(1)、有注明 */
IF COL_LENGTH('dbo.yj_form_approval', 'self_audit') IS NULL
    RAISERROR('self_audit 列未建立', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.yj_form_approval')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.yj_form_approval'), 'self_audit', 'ColumnId')
                  AND name = N'MS_Description')
    RAISERROR('self_audit 缺少中文注明', 16, 1);
GO
