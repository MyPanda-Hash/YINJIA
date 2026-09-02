-- migrate-usage-log.sql — 使用记录表(登录 + 面板权限操作统一一张表)
-- 决策见 CONTEXT.md「使用权限查看」:不复用旧系统 s_log、不展示其历史;
-- 记录范围 = 业务动作(callButton 按钮 + deleteForms)+ 登录成功;查询/刷新不记。
IF OBJECT_ID('dbo.yj_usage_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.yj_usage_log (
        id          BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_name   nvarchar(50)  NOT NULL,             -- 账号
        real_name   nvarchar(50)  NOT NULL,             -- 姓名
        event_type  nvarchar(10)  NOT NULL,             -- login / action
        panel_name  nvarchar(100) NULL,                 -- 面板名(中文;action 时有)
        action_name nvarchar(50)  NULL,                 -- 动作名(登录 / 按钮名)
        doc_no      nvarchar(200) NULL,                 -- 单据号(可选,取不到为空)
        ip          nvarchar(50)  NULL,                 -- 来源 IP
        created_at  datetime2     NOT NULL CONSTRAINT DF_yj_usage_log_created DEFAULT SYSDATETIME()
    );
    CREATE INDEX ix_usage_log_created ON dbo.yj_usage_log (created_at DESC);
    CREATE INDEX ix_usage_log_user   ON dbo.yj_usage_log (user_name);
    CREATE INDEX ix_usage_log_panel  ON dbo.yj_usage_log (panel_name);
    PRINT 'yj_usage_log created';
END
ELSE
    PRINT 'yj_usage_log already exists';
