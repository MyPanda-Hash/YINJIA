-- migrate-revoke-rd-review-approve.sql
-- 收回 rd_review 角色对 RD_APPROVAL 的审批权(2026-10-09 用户口径:cp 不该能点「审批通过」)
-- 幂等;两个账套都要执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)
--
-- 背景:2026-10-08 的 migrate-rd-approval-liaison-owner.sql 第 ④ 步给 rd_review(实测 role_id=4,
-- 唯一成员 cp 陈秀丽)开了 RD_APPROVAL 的 can_approve='Y',让研发审核角色能「审批并定级 → 分发对接人」。
-- 但它**只写了派生列 can_approve,没写源列 perms** ⇒ 权限矩阵界面(读 perms 含 audit)显示 cp 无审批权,
-- 运行时(读 can_approve)却放行 —— 界面说没有、按钮却亮着还能点。本脚本把两列一起归零。
--
-- ⚠ 用户已确认接受的后果:立项申请此后只有**管理员**能「审批通过 / 项目定级 / 分发对接人」
--   (项目定级已收窄为"只能由本单审批人做",而审批人只剩管理员)。
SET NOCOUNT ON;
GO

DECLARE @role int = (SELECT TOP 1 id FROM yj_role WHERE role_code = N'rd_review');

IF @role IS NULL
BEGIN
  PRINT N'[WARN] 未找到 role_code=rd_review 的角色,未改动';
END
ELSE
BEGIN
  PRINT N'[前] role_id=' + CAST(@role AS nvarchar(10)) + N' 的 RD_APPROVAL 行:';
  SELECT panel_code, ISNULL(perms, N'(null)') AS perms, ISNULL(can_approve, N'(null)') AS can_approve
  FROM yj_role_panel WHERE role_id = @role AND panel_code = N'RD_APPROVAL';

  -- ① 派生列归零
  UPDATE yj_role_panel SET can_approve = N'N'
  WHERE role_id = @role AND panel_code = N'RD_APPROVAL' AND ISNULL(can_approve, N'N') <> N'N';
  PRINT N'[OK] can_approve → N,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

  -- ② 源列里的 audit 词一并摘掉(两列同向,界面与运行时不再打架)
  --    兼容 audit 在开头 / 中间 / 结尾,逗号分隔;摘完清空串
  UPDATE yj_role_panel
  SET perms = NULLIF(LTRIM(RTRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(perms, N''),
          N',audit,', N','), N'audit,', N''), N',audit', N''), N'audit', N'')
      )), N'')
  WHERE role_id = @role AND panel_code = N'RD_APPROVAL' AND ISNULL(perms, N'') LIKE N'%audit%';
  PRINT N'[OK] perms 中的 audit 词已摘除,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

  PRINT N'[后] RD_APPROVAL 行:';
  SELECT panel_code, ISNULL(perms, N'(null)') AS perms, ISNULL(can_approve, N'(null)') AS can_approve
  FROM yj_role_panel WHERE role_id = @role AND panel_code = N'RD_APPROVAL';

  -- ③ 自检:两列都不再带审批权
  DECLARE @bad int = (SELECT COUNT(*) FROM yj_role_panel
     WHERE role_id = @role AND panel_code = N'RD_APPROVAL'
       AND (ISNULL(can_approve, N'N') = N'Y' OR ISNULL(perms, N'') LIKE N'%audit%'));
  IF @bad = 0
    PRINT N'[OK] 自检通过:rd_review 对 RD_APPROVAL 的 can_approve 与 perms(audit) 均已清零';
  ELSE
    PRINT N'[WARN] 自检失败:仍有 ' + CAST(@bad AS nvarchar(4)) + N' 行带审批权';
END
GO
