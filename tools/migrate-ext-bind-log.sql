-- migrate-ext-bind-log.sql — 动态字段绑定审计(规格 §9;docs/design/动态字段扩展-备用列池-V1.0.md)
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
IF OBJECT_ID('yj_ext_bind_log') IS NULL
BEGIN
  CREATE TABLE yj_ext_bind_log (
    id         bigint IDENTITY(1,1) PRIMARY KEY,
    panel_code varchar(40)  NOT NULL,
    label      nvarchar(60) NOT NULL,
    col_name   sysname      NOT NULL,
    action     nvarchar(10) NOT NULL,
    op_by      nvarchar(50) NOT NULL,
    op_at      datetime2    NOT NULL CONSTRAINT df_yjebl_at DEFAULT GETDATE(),
    detail     nvarchar(500) NULL
  );
  CREATE INDEX ix_yjebl_panel ON yj_ext_bind_log (panel_code, op_at);
  EXEC sp_addextendedproperty N'MS_Description', N'动态字段绑定审计(bind绑定/retire退绑/clear清空;备用列池操作留痕)', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log';
  EXEC sp_addextendedproperty N'MS_Description', N'面板编码', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'panel_code';
  EXEC sp_addextendedproperty N'MS_Description', N'字段中文标签(数据键)', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'label';
  EXEC sp_addextendedproperty N'MS_Description', N'绑定的备用列名(如 备用5)', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'col_name';
  EXEC sp_addextendedproperty N'MS_Description', N'动作:bind/retire/clear', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'action';
  EXEC sp_addextendedproperty N'MS_Description', N'操作人账号', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'op_by';
  EXEC sp_addextendedproperty N'MS_Description', N'操作时间', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'op_at';
  EXEC sp_addextendedproperty N'MS_Description', N'补充说明(如dirty确认/清空行数)', N'SCHEMA', N'dbo', N'TABLE', N'yj_ext_bind_log', N'COLUMN', N'detail';
  PRINT N'yj_ext_bind_log 已创建';
END
ELSE PRINT N'yj_ext_bind_log 已存在,跳过';
GO
