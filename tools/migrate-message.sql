/* ============================================================
   消息功能 — 数据层(2026-09-09)
   新建 yj_message:业务事件消息(定向到具体账号),与「待办/预警/产品开发」实时视图分开。
   设计要点:
   - 收件人在发送时展开成具体账号(每人一行),已读按人记录
   - 正文不存中文,存「消息码 + 参数 JSON」,前端按 i18n 渲染(切语言消息跟着变)
   幂等:IF NOT EXISTS / 动态 DDL,可重复执行。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-message.sql
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.yj_message','U') IS NULL
EXEC(N'CREATE TABLE dbo.yj_message (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_yj_message PRIMARY KEY,
    收件人       NVARCHAR(100)  NOT NULL,
    消息码       VARCHAR(50)    NOT NULL,
    参数         NVARCHAR(1000) NULL,
    面板编码     VARCHAR(50)    NULL,
    单据编号     NVARCHAR(100)  NULL,
    已读         CHAR(1)        NOT NULL CONSTRAINT DF_yj_message_read DEFAULT ''N'',
    读取时间     DATETIME2      NULL,
    创建时间     DATETIME2      NOT NULL CONSTRAINT DF_yj_message_time DEFAULT SYSDATETIME(),
    asp_user1   NVARCHAR(100)  NULL,
    asp_time1   DATETIME2      NULL,
    asp_user2   NVARCHAR(100)  NULL,
    asp_time2   DATETIME2      NULL,
    asp_cancel  CHAR(1)        NOT NULL CONSTRAINT DF_yj_message_cancel DEFAULT ''N''
)');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_yj_message_recipient'
               AND object_id = OBJECT_ID('dbo.yj_message'))
CREATE INDEX ix_yj_message_recipient ON dbo.yj_message (收件人, 已读, 创建时间 DESC);
GO

SELECT CASE WHEN OBJECT_ID('dbo.yj_message','U') IS NULL THEN N'建表失败' ELSE N'yj_message 就绪' END AS 结果;
GO
