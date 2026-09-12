/* ============================================================
   规格书两级分发 —— 数据层(2026-09-12)
   1) 新建 rd_spec_assign(一张规格书单一条有效分配:责任人+负责人快照)
   2) rd_dev_task 补「负责人」列(下发时快照总负责人账号;NULL=未落实,任务挂起)
   幂等:全部 IF NOT EXISTS / IF COL_LENGTH,可重复执行。
   执行:sqlcmd -f 65001 -S localhost -E -d HSDZ_MES -i tools\migrate-rd-spec-assign.sql
        (必须带 -f 65001;否则 sqlcmd 按控制台码页读 UTF-8 文件,
         多字节字符会被截断并在筛选索引语句处报 Msg 102)
   依据:2026-09-12 用户口径——产品开发下发时规格书任务先到总负责人
        (=产品信息表「责任人」姓名→yj_user.real_name 匹配账号),
        由总负责人按种类分发责任人并建单;分配单仅 责任人∪总负责人∪管理员 可编辑。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 规格书分配表(一行 = 一张规格书单的有效分配) ----------
   注:用 EXEC(N'...') 动态执行 —— 守卫式 DDL 在对象已存在时,
   普通 IF...CREATE 仍会在解析期报错,动态 SQL 可避免。 */
IF OBJECT_ID('dbo.rd_spec_assign','U') IS NULL
EXEC(N'CREATE TABLE dbo.rd_spec_assign (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_rd_spec_assign PRIMARY KEY,
    产品编号      NVARCHAR(200) NOT NULL,
    单据编号      NVARCHAR(50)  NOT NULL,
    规格书种类    NVARCHAR(60)  NOT NULL,
    负责人        NVARCHAR(50)  NOT NULL,
    责任人        NVARCHAR(50)  NOT NULL,
    asp_user1    NVARCHAR(100) NULL,
    asp_time1    DATETIME2     NULL,
    asp_user2    NVARCHAR(100) NULL,
    asp_time2    DATETIME2     NULL,
    asp_cancel   CHAR(1)       NOT NULL CONSTRAINT DF_rd_spec_assign_cancel DEFAULT ''N''
)');
GO

/* 一张单据只允许一条有效分配(作废后可重新分配)
   注:筛选索引要求创建会话 QUOTED_IDENTIFIER / ANSI_NULLS 为 ON,
   且 SET 必须与 CREATE INDEX 同批次(跨 GO 不生效) */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rd_spec_assign_doc'
               AND object_id = OBJECT_ID('dbo.rd_spec_assign'))
CREATE UNIQUE INDEX ux_rd_spec_assign_doc
    ON dbo.rd_spec_assign (单据编号) WHERE asp_cancel = 'N';
GO

/* ---------- 2. rd_dev_task 补「负责人」列(总负责人账号快照) ---------- */
IF COL_LENGTH('dbo.rd_dev_task', N'负责人') IS NULL
    ALTER TABLE dbo.rd_dev_task ADD [负责人] NVARCHAR(50) NULL;
GO

PRINT N'规格书两级分发数据层迁移完成';
GO
