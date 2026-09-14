-- migrate-report-template.sql — 报表模板入库(ADR-0002):yj_report_template 表
-- so_order 模板数据由 ReportService 启动播种(表空且 classpath 有 so_order.jrxml 时导入),不在此读文件
SET NOCOUNT ON;
BEGIN TRY
  IF OBJECT_ID('yj_report_template') IS NULL
    CREATE TABLE yj_report_template (
      id            int IDENTITY(1,1) PRIMARY KEY,
      template_code nvarchar(60)  NOT NULL UNIQUE,
      panel_code    nvarchar(30)  NOT NULL,
      name          nvarchar(100) NOT NULL,
      jrxml_text    nvarchar(max) NOT NULL,
      enabled       char(1)       NOT NULL DEFAULT 'Y',
      remark        nvarchar(200) NULL,
      create_by     nvarchar(50)  NULL,
      create_at     datetime2     NULL DEFAULT SYSDATETIME(),
      update_by     nvarchar(50)  NULL,
      update_at     datetime2     NULL
    );
END TRY
BEGIN CATCH
  PRINT '建表跳过(无 DDL 权限或已存在)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'yj_report_template')
  RAISERROR(N'yj_report_template 建表失败', 16, 1);
GO
PRINT N'migrate-report-template 完成';
GO
