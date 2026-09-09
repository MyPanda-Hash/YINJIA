/* ============================================================
   产品开发下发 —— 数据层(阶段一)
   1) 新建 rd_dev_task(产品 × 面板)记录「已下发」
   2) 组装BOM「产品编号」、规格书「编号」改为参照 RD_PROD_INFO
      —— 产品信息表 ≤20 行时前端自动用「可搜索下拉 + 允许手输」形态
   幂等:全部 IF NOT EXISTS / 条件 UPDATE,可重复执行。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-rd-dev-task.sql
        (必须带 -f 65001;否则 sqlcmd 按控制台码页读 UTF-8 文件,
         多字节字符会被截断并在筛选索引语句处报 Msg 102)
   依据:2026-09-09 设计确认(产品键/载体/状态口径/已下发判定)
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 下发记录表(一行 = 产品 × 目标面板) ----------
   注:用 EXEC(N'...') 动态执行 —— 守卫式 DDL 在对象已存在时,
   普通 IF...CREATE 仍会在解析期报错,动态 SQL 可避免。 */
IF OBJECT_ID('dbo.rd_dev_task','U') IS NULL
EXEC(N'CREATE TABLE dbo.rd_dev_task (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_rd_dev_task PRIMARY KEY,
    产品编号      NVARCHAR(200) NOT NULL,
    产品名称      NVARCHAR(200) NULL,
    源单据号      NVARCHAR(100) NULL,
    目标面板      VARCHAR(50)   NOT NULL,
    下发人        NVARCHAR(100) NULL,
    下发时间      DATETIME2     NOT NULL CONSTRAINT DF_rd_dev_task_time DEFAULT SYSDATETIME(),
    asp_user1    NVARCHAR(100) NULL,
    asp_time1    DATETIME2     NULL,
    asp_user2    NVARCHAR(100) NULL,
    asp_time2    DATETIME2     NULL,
    asp_cancel   CHAR(1)       NOT NULL CONSTRAINT DF_rd_dev_task_cancel DEFAULT ''N''
)');
GO

/* 同一产品同一目标面板只允许一条有效下发记录(「已下发」按产品编号判定)
   注:筛选索引要求创建会话 QUOTED_IDENTIFIER / ANSI_NULLS 为 ON,
   且 SET 必须与 CREATE INDEX 同批次(跨 GO 不生效) */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rd_dev_task_prod_panel'
               AND object_id = OBJECT_ID('dbo.rd_dev_task'))
CREATE UNIQUE INDEX ux_rd_dev_task_prod_panel
    ON dbo.rd_dev_task (产品编号, 目标面板) WHERE asp_cancel = 'N';
GO

/* ---------- 2. 产品键统一为参照 RD_PROD_INFO ---------- */
/* 组装BOM表:产品编号(原纯文本) */
UPDATE yj_field
SET data_type = N'参照', ref_panel = N'RD_PROD_INFO', ref_field = N'产品编号', display_field = N'产品名称'
WHERE panel_code = N'RD_ASM_BOM' AND col_name = N'产品编号'
  AND ISNULL(ref_panel, N'') <> N'RD_PROD_INFO';
GO

/* 规格书:编号(语义即产品编号,原纯文本) */
UPDATE yj_field
SET data_type = N'参照', ref_panel = N'RD_PROD_INFO', ref_field = N'产品编号', display_field = N'产品名称'
WHERE panel_code = N'RD_SPEC_DOC' AND col_name = N'编号'
  AND ISNULL(ref_panel, N'') <> N'RD_PROD_INFO';
GO

PRINT N'产品开发下发数据层迁移完成';
GO
