-- migrate-attachment.sql — 附件字段基础设施:yj_attachment 表
-- 首个使用方:RD_PROD_INFO(产品信息表)·「客户图纸或规格书」改为可上传附件
-- 附件锚点 = panel_code + doc_no(单据编号) + field_key(字段中文键=头表列名);
-- 文件本体存后端磁盘(存储名=UUID+安全扩展,杜绝路径穿越),本表只存元数据,原文件名保留。
-- 幂等:可重复执行。运行(UTF-8 无 BOM,需 -f 65001):
--   sqlcmd -S localhost -H HSDZ_MES -E -f 65001 -i migrate-attachment.sql
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('yj_attachment') IS NULL CREATE TABLE yj_attachment (
    id           int IDENTITY(1,1) PRIMARY KEY,
    panel_code   varchar(40)  NOT NULL,            -- 面板编码(yj_panel.panel_code)
    doc_no       nvarchar(60) NOT NULL,            -- 单据编号(附件挂靠的单据)
    field_key    nvarchar(100) NOT NULL,           -- 字段中文键(=头表列名,须在 yj_field 注册)
    file_name    nvarchar(260) NOT NULL,           -- 原始文件名(保留原名,展示/打印用)
    stored_name  nvarchar(140) NOT NULL,           -- 磁盘存储名(UUID+安全扩展,服务端生成)
    file_size    bigint       NOT NULL,            -- 字节
    content_type nvarchar(200) NULL,
    asp_user1    nvarchar(50) NULL,                -- 上传人
    asp_time1    datetime2     NULL,               -- 上传时间
    asp_user2    nvarchar(50) NULL,                -- 删除人(硬删前行即止,留痕到此为止)
    asp_time2    datetime2     NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_yja_doc')
    CREATE INDEX ix_yja_doc ON yj_attachment (panel_code, doc_no, field_key, id);
GO
PRINT N'yj_attachment 附件表就绪';
GO
