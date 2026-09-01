/* 报表栏目设置表(报表表头筛选与排序补丁):
   按面板编码持久化 JSON {columns:[{prop,label,visible}],sort:{prop,order}},
   全部用户共享;后端 /api/px/reportColumnSettings 读写。 */
USE HSDZ_MES;
SET NOCOUNT ON;
IF OBJECT_ID('report_column_settings') IS NULL
CREATE TABLE report_column_settings (
    id          int IDENTITY(1,1) PRIMARY KEY,
    panel_code  varchar(50)   NOT NULL,
    settings    nvarchar(max) NOT NULL,
    update_by   nvarchar(50)  NULL,
    update_time datetime2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_report_col UNIQUE (panel_code)
);
GO
SELECT name AS created_table FROM sys.tables WHERE name = 'report_column_settings';
GO
