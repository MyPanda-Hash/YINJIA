-- migrate-rd-modify-reason-2026-09-30.sql
-- 「申请修改」必填修改原因:暂存列 + 归档列 —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   需求原文(《产品开发系统需求汇总.xlsx》sheet「数据记录表」第 2 条):
     2. 修改:**不需要反审核,只需填写修改原因**
   用户口径(2026-09-30):「改完需要再审核」—— 即保留现有的
     「申请修改 → 管理员批 → 改 → 提交审批 → 管理员批 → 再归档」闭环,
     只补上**修改原因**这一环(申请时必填、留痕、可见)。

   现状(动手前实测):
     · 「申请修改」在前端**没有任何输入框**(PanelxList.onSideAction 只对
       提交审批/审批通过/审批驳回/会签驳回 弹 prompt);
     · 后端 modifyRequest 写进 yj_form_approval.opinion 的**恒为空串**(拿不到值);
     · yj_doc_modify_log **没有原因列**(列清单里只有 changes/change_meta)。

   为什么两列都要:
     · yj_doc_status.modify_reason —— 「申请修改」到「修改审批通过」之间**暂存**原因。
       修改记录那一行是 modifyApprove 时才 INSERT 的,那时的操作人是**管理员**,
       申请人填的原因必须先在状态行上落住。
     · yj_doc_modify_log.modify_reason —— 归档进修改记录。log 是**历史快照**,
       只读 status 的当前值会让历次修改的原因互相覆盖、历史丢失。
   两列同名 modify_reason,与各表既有列风格一致(yj_doc_modify_log 全表英文列名)。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 暂存列(申请时写,审批通过时复制进 log 并保留原值备查)
IF COL_LENGTH('dbo.yj_doc_status', N'modify_reason') IS NULL
BEGIN
  ALTER TABLE yj_doc_status ADD modify_reason nvarchar(500) NULL;
  PRINT N'[OK] yj_doc_status 加列 modify_reason';
END
ELSE PRINT N'[SKIP] yj_doc_status.modify_reason 已存在';
GO

-- ② 归档列(修改记录里长期可见)
IF COL_LENGTH('dbo.yj_doc_modify_log', N'modify_reason') IS NULL
BEGIN
  ALTER TABLE yj_doc_modify_log ADD modify_reason nvarchar(500) NULL;
  PRINT N'[OK] yj_doc_modify_log 加列 modify_reason';
END
ELSE PRINT N'[SKIP] yj_doc_modify_log.modify_reason 已存在';
GO

-- ③ 列级中文注明(新增列必须自带)
IF COL_LENGTH('dbo.yj_doc_status', N'modify_reason') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
              WHERE ep.major_id = OBJECT_ID(N'dbo.yj_doc_status')
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_doc_status'), N'modify_reason', 'ColumnId')
                AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'修改原因(申请修改时必填填写的说明;审批通过后复制进 yj_doc_modify_log.modify_reason 归档。需求《产品开发系统需求汇总》sheet「数据记录表」第2条:修改只需填写修改原因)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_status', N'COLUMN', N'modify_reason';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'修改原因(申请修改时必填填写的说明;审批通过后复制进 yj_doc_modify_log.modify_reason 归档。需求《产品开发系统需求汇总》sheet「数据记录表」第2条:修改只需填写修改原因)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_status', N'COLUMN', N'modify_reason';
END

IF COL_LENGTH('dbo.yj_doc_modify_log', N'modify_reason') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
              WHERE ep.major_id = OBJECT_ID(N'dbo.yj_doc_modify_log')
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_doc_modify_log'), N'modify_reason', 'ColumnId')
                AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'修改原因(本次修改的申请说明,由 yj_doc_status.modify_reason 复制而来;「修改记录」弹窗展示)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_modify_log', N'COLUMN', N'modify_reason';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'修改原因(本次修改的申请说明,由 yj_doc_status.modify_reason 复制而来;「修改记录」弹窗展示)',
         N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_modify_log', N'COLUMN', N'modify_reason';
END
GO

-- ④ 自检
DECLARE @a int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_doc_status') AND name = N'modify_reason');
DECLARE @b int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_doc_modify_log') AND name = N'modify_reason');
IF @a = 1 AND @b = 1
  PRINT N'[OK] 自检通过:yj_doc_status / yj_doc_modify_log 的 modify_reason 均已就位';
ELSE
  PRINT N'[WARN] 自检异常:yj_doc_status=' + CAST(@a AS nvarchar(3)) + N' / yj_doc_modify_log=' + CAST(@b AS nvarchar(3)) + N'(期望 1/1)';
GO
