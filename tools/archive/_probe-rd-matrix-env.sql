/* 只读环境探针:研发立项流程矩阵验证前置事实(DbSync run 用;仅回显错误行,故一律 RAISERROR) */
SET NOCOUNT ON;
DECLARE @m nvarchar(400), @n int;

SET @m = N'DB=' + DB_NAME();
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 1) admin 账号
SELECT @n = COUNT(*) FROM yj_user WHERE is_admin = 'Y' AND ISNULL(enabled,'1') = '1';
SET @m = N'ADMIN_COUNT=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;
DECLARE @admins nvarchar(400) = N'';
SELECT @admins = @admins + username + N'/' + real_name + N';' FROM yj_user WHERE is_admin = 'Y';
SET @m = N'ADMINS=' + @admins;
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 2) 三个已知账号
SET @admins = N'';
SELECT @admins = @admins + u.username + N'/' + u.real_name + N'/role=' + ISNULL(CAST(u.role_id AS nvarchar), N'-')
       + N'/admin=' + ISNULL(u.is_admin, N'-') + N'/enabled=' + ISNULL(u.enabled, N'-') + N';'
FROM yj_user u WHERE u.username IN ('cp','glm53','liulei','admin');
SET @m = N'USERS=' + @admins;
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 3) RD_APPROVAL 审批权
SET @admins = N'';
SELECT @admins = @admins + u.username + N'(' + ISNULL(r.role_name, N'?') + N');'
FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id
LEFT JOIN yj_role r ON r.id = u.role_id
WHERE rp.panel_code = 'RD_APPROVAL' AND rp.can_approve = 'Y';
SET @m = N'APPROVERS_RD_APPROVAL=' + ISNULL(NULLIF(@admins, N''), N'(none)');
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 4) rd_approval 关键列
SELECT @n = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('rd_approval')
  AND name IN (N'单据编号', N'文档编号', N'项目等级', N'备用1', N'备用2', N'申请立项人', N'asp_user1', N'asp_cancel');
SET @m = N'RD_APPROVAL_COLS_HIT=' + CAST(@n AS nvarchar) + N'/8';
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 5) 面板字段登记(RD_APPROVAL / RD_PLAN / RD_PROGRESS)
SET @admins = N'';
SELECT @admins = @admins + panel_code + N'.' + label + N'(editable=' + CAST(ISNULL(editable,0) AS nvarchar) + N');'
FROM yj_field WHERE panel_code = 'RD_APPROVAL'
  AND label IN (N'项目等级', N'对接人', N'项目责任人', N'申请立项人', N'项目名称', N'文档编号', N'单据编号');
SET @m = N'RD_APPROVAL_FIELDS=' + ISNULL(NULLIF(@admins, N''), N'(none)');
RAISERROR(@m, 16, 1) WITH NOWAIT;

SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = 'RD_PLAN' AND label IN (N'项目定级', N'负责人', N'文档编号');
SET @m = N'RD_PLAN_FIELDS_HIT=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;

SELECT @n = COUNT(*) FROM yj_panel WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS');
SET @m = N'PANELS_HIT=' + CAST(@n AS nvarchar) + N'/3';
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 6) 现状:测试库已有多少立项单/计划单/进度单
SELECT @n = COUNT(*) FROM rd_approval WHERE ISNULL(asp_cancel,'N') <> 'Y';
SET @m = N'EXIST_RD_APPROVAL=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;
SELECT @n = COUNT(*) FROM rd_plan WHERE ISNULL(asp_cancel,'N') <> 'Y';
SET @m = N'EXIST_RD_PLAN=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;
SELECT @n = COUNT(*) FROM rd_progress;
SET @m = N'EXIST_RD_PROGRESS=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;

-- 7) 单据编号发号器(s_allno,见 FormNoService.next)
SET @admins = N'';
SELECT @admins = @admins + lb + N'/' + ny + N'/' + dh + N';'
FROM s_allno WHERE lb IN ('LXA','LXP') AND ny LIKE '%-%' + CAST(YEAR(GETDATE()) AS nvarchar(4)) + '%';
SET @m = N'FORM_NO_TAIL=' + ISNULL(NULLIF(@admins, N''), N'(none)');
RAISERROR(@m, 16, 1) WITH NOWAIT;

SELECT @n = COUNT(*) FROM s_allno WHERE lb = 'LXA';
SET @m = N'S_ALLNO_LXA_TOTAL=' + CAST(@n AS nvarchar);
RAISERROR(@m, 16, 1) WITH NOWAIT;

RAISERROR(N'ENV_PROBE_DONE', 16, 1) WITH NOWAIT;
