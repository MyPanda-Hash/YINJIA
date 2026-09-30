-- migrate-rd-file-owner-2026-09-30.sql
-- 新建「文件负责人」角色 + 三个文件责任人账号(刘磊/柴善银/冯敏) —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   需求原文(《产品开发系统需求汇总.xlsx》sheet「文件汇总表」的「产品文件流程」):
     … → 4 任务分发(秀丽) → 5.1 规格书(项目负责人) → 5.2 成型控制要点(**刘磊**)
       → 5.3 组装控制要求(**柴善银**) → 5.4 出货控制计划(**冯敏**)
   即 5.2/5.3/5.4 的责任人是**固定的具体人**。
   用户口径(2026-09-30):「建账号」—— 账号名用**拼音**、初始口令用**默认初始密码**、
   新建「文件负责人」角色。

   现状(动手前实测):yj_user 里**没有**这三个人(全部 10 个账号:admin / cp 陈秀丽 /
   glm53 彭于晏 / tester01 / 6 个 demo_*),所以分发弹窗的候选里根本选不到他们 ——
   需求这条无从落地。

   初始口令口径:与既有非 admin 账号一致 = **123456**,
   哈希**沿用 cp 的**(见 tools/migrate-prodinfo-twolevel.sql:29-35 的同一做法:
   「密码哈希沿用现有演示账号 ⇒ 初始口令 123456」)。不新造哈希、不硬编码密文。
   ⚠ admin 的 password_hash 不可直接沿用:它在后续某轮已被升级成 yj1$ 新格式,
     而那三个人的初始口令应当与普通账号一致(BCrypt 系),故取 cp 的。

   dept_id 暂留 NULL:需求只说了"文件负责人"是谁,没说部门归属;
   部门可后续在「组织架构」里补,不影响编辑权(编辑权来自 rd_dev_task.负责人,不是角色)。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 角色「文件负责人」
IF NOT EXISTS (SELECT 1 FROM yj_role WHERE role_code = N'rd_file_owner')
BEGIN
  INSERT INTO yj_role (role_code, role_name, remark, is_admin)
  VALUES (N'rd_file_owner', N'文件负责人',
          N'产品开发四个受控文件的编写责任人(规格书 / 成型工艺清单 / 组装工艺清单 / 出货检验计划表)。'
        + N'2026-09-30 依《产品开发系统需求汇总.xlsx》sheet「文件汇总表」的 5.2/5.3/5.4 固定责任人新建;'
        + N'面板权限由 role_code=user 整份复制。本角色**不含审批权**:文件审批仍由管理员/研发审核角色承担。',
          N'N');
  PRINT N'[OK] 新建角色 文件负责人(rd_file_owner)';
END
ELSE PRINT N'[SKIP] 角色 rd_file_owner 已存在';
GO

-- ② 复制普通用户角色的面板权限(逐面板,已存在的跳过 —— 幂等且不覆盖人工调整)
DECLARE @new int = (SELECT id FROM yj_role WHERE role_code = N'rd_file_owner');
DECLARE @usr int = (SELECT id FROM yj_role WHERE role_code = N'user');
IF @new IS NOT NULL AND @usr IS NOT NULL
BEGIN
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
  SELECT @new, rp.panel_code, rp.can_approve, rp.perms
    FROM yj_role_panel rp
   WHERE rp.role_id = @usr
     AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = @new AND x.panel_code = rp.panel_code);
  PRINT N'[OK] 复制普通用户面板权限 → rd_file_owner,新增 ' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
END
ELSE PRINT N'[WARN] 角色缺失,跳过权限复制';
GO

-- ③ 三个账号(拼音账号名;初始口令 123456,哈希沿用 cp)
DECLARE @role int = (SELECT id FROM yj_role WHERE role_code = N'rd_file_owner');
DECLARE @pw nvarchar(200) = (SELECT TOP 1 password_hash FROM yj_user WHERE username = N'cp');

IF @role IS NOT NULL AND @pw IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = N'liulei')
  BEGIN
    INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
    VALUES (N'liulei', @pw, N'刘磊', 'N', NULL, @role, '1');
    PRINT N'[OK] 账号 liulei(刘磊)已建';
  END ELSE PRINT N'[SKIP] 账号 liulei 已存在';

  IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = N'chaishanyin')
  BEGIN
    INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
    VALUES (N'chaishanyin', @pw, N'柴善银', 'N', NULL, @role, '1');
    PRINT N'[OK] 账号 chaishanyin(柴善银)已建';
  END ELSE PRINT N'[SKIP] 账号 chaishanyin 已存在';

  IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = N'fengmin')
  BEGIN
    INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
    VALUES (N'fengmin', @pw, N'冯敏', 'N', NULL, @role, '1');
    PRINT N'[OK] 账号 fengmin(冯敏)已建';
  END ELSE PRINT N'[SKIP] 账号 fengmin 已存在';
END
ELSE PRINT N'[WARN] 角色或口令哈希缺失,跳过账号创建(检查 rd_file_owner 角色与 cp 账号)';
GO

-- ④ 自检
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_user u JOIN yj_role r ON r.id = u.role_id
                     WHERE u.username IN (N'liulei', N'chaishanyin', N'fengmin')
                       AND r.role_code = N'rd_file_owner' AND ISNULL(u.enabled, '1') = '1');
DECLARE @perm int = (SELECT COUNT(*) FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id WHERE r.role_code = N'rd_file_owner');
DECLARE @admin int = (SELECT COUNT(*) FROM yj_user WHERE username IN (N'liulei', N'chaishanyin', N'fengmin') AND ISNULL(is_admin, 'N') = 'Y');
IF @cnt = 3 AND @perm > 0 AND @admin = 0
  PRINT N'[OK] 自检通过:三个账号已挂 rd_file_owner 且启用(权限 ' + CAST(@perm AS nvarchar(5)) + N' 行,均非管理员)';
ELSE
  PRINT N'[WARN] 自检异常:账号 ' + CAST(@cnt AS nvarchar(3)) + N'/3、权限 ' + CAST(@perm AS nvarchar(5))
      + N' 行、误设管理员 ' + CAST(@admin AS nvarchar(3)) + N' 个';
GO
