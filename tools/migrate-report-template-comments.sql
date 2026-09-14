-- migrate-report-template-comments.sql — yj_report_template 表/列中文注明(补遗漏:该表建于注释迁移之后)
-- 幂等:有则更新,无则添加
SET NOCOUNT ON;
DECLARE @t sysname = N'yj_report_template';

-- 表注明
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'报表模板表(ADR-0002:DB 存储精细模板,上传即编译校验生效免重启;template_code 唯一,panel_code 绑定面板)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'报表模板表(ADR-0002:DB 存储精细模板,上传即编译校验生效免重启;template_code 唯一,panel_code 绑定面板)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

-- 列注明
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'template_code', N'模板编码(接口 code 参数,小写字母/数字/下划线,唯一)'),
  (N'panel_code',    N'绑定面板编码(yj_panel.panel_code)'),
  (N'name',          N'报表名(导出弹窗下拉显示)'),
  (N'jrxml_text',    N'JasperReports 模板文本(上传时已编译校验)'),
  (N'enabled',       N'启用标志(Y/N;停用后面板下拉不可见)'),
  (N'remark',        N'备注');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO
PRINT N'migrate-report-template-comments 完成';
GO
