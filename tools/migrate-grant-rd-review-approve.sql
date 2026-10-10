-- migrate-grant-rd-review-approve.sql
-- 【终稿】rd_review 角色对 RD_APPROVAL 保留审批权,并把源列 perms 补上 audit(界面与运行时归一)
-- 幂等;两个账套都要执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)
--
-- 决策沿革(一天内翻了两次,如实留档):
--   2026-10-08 migrate-rd-approval-liaison-owner.sql 第 ④ 步:给 rd_review(实测 role_id=4,
--     唯一成员 cp 陈秀丽)开 RD_APPROVAL 的 can_approve='Y' —— 让研发审核角色能
--     「审批并定级 → 分发对接人」。**但它只写了派生列 can_approve,没写源列 perms。**
--   2026-10-09 用户先说"cp 不该能点审批通过"⇒ 写了 migrate-revoke-rd-review-approve.sql 收回;
--     随即改为"还是选 a":保留审批权,改修那次留下的两列不同步。
--   ⇒ 本脚本是终稿。revoke 那条**保留在链里不改字节**(DbSync 按内容哈希判重跑,改字节会重跑;
--     且它已登记进 yj_schema_log,删文件会让体检「清单↔文件不一致」报错),
--     新库链序为 revoke → grant,净效果 = 本脚本。
--
-- 为什么两列都要写:权限矩阵界面(组织架构里勾「该面板·审核反审核」)读 `perms` 含 audit
--   (PanelPermissionService:审批类按钮 → 授权词 audit);运行时(ButtonService.canApprove /
--   AuthService.approvePanelsOf)读派生列 `can_approve`。只写一列 ⇒ 界面说没有、按钮却亮着还能点。
--
-- 后果(用户已确认):cp 继续能「审批通过 / 项目定级 / 分发对接人」。
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

  -- ① 派生列置 Y(revoke 之后回来;幂等)
  UPDATE yj_role_panel SET can_approve = N'Y'
  WHERE role_id = @role AND panel_code = N'RD_APPROVAL' AND ISNULL(can_approve, N'N') <> N'Y';
  PRINT N'[OK] can_approve → Y,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

  -- ② 源列补 audit(已含则不重复插);分隔符沿用该行现有的逗号/分号/空格
  UPDATE yj_role_panel
  SET perms = CASE
        WHEN ISNULL(perms, N'') = N''      THEN N'audit'
        WHEN perms LIKE N'%,%'             THEN perms + N',audit'
        WHEN perms LIKE N'%;%'             THEN perms + N';audit'
        WHEN perms LIKE N'% %'             THEN perms + N' audit'
        ELSE perms + N',audit'
      END
  WHERE role_id = @role AND panel_code = N'RD_APPROVAL' AND ISNULL(perms, N'') NOT LIKE N'%audit%';
  PRINT N'[OK] perms 补 audit,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

  PRINT N'[后] RD_APPROVAL 行:';
  SELECT panel_code, ISNULL(perms, N'(null)') AS perms, ISNULL(can_approve, N'(null)') AS can_approve
  FROM yj_role_panel WHERE role_id = @role AND panel_code = N'RD_APPROVAL';

  -- ③ 自检:两列都带审批权
  DECLARE @bad int = (SELECT COUNT(*) FROM yj_role_panel
     WHERE role_id = @role AND panel_code = N'RD_APPROVAL'
       AND (ISNULL(can_approve, N'N') <> N'Y' OR ISNULL(perms, N'') NOT LIKE N'%audit%'));
  IF @bad = 0
    PRINT N'[OK] 自检通过:rd_review 对 RD_APPROVAL 的 can_approve=Y 且 perms 含 audit(两列同向)';
  ELSE
    PRINT N'[WARN] 自检失败:仍有 ' + CAST(@bad AS nvarchar(4)) + N' 行两列不同向';
END
GO
