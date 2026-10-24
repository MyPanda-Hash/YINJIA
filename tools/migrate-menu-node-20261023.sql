/* ============================================================
   migrate-menu-node-20261023.sql
   系统管理平台 · 菜单设计(一级/二级分组与面板名称/位置/顺序 可编辑)—— 建 1 张表

   用户口径(2026-10-23):
     "给系统管理模块加上一个菜单命名的功能,就是可以编辑各个面板的位置与一级模块与二级模块的
      分支和名字,就不需要每次修改都要重新打包部署"

   为什么这样建:
   - **导航基线仍在代码里**(`frontend/src/business/menus.js`):每个节点的
     `code / path / panelCode / icon / adminOnly` 是数据键,和路由注册、权限词、面板元数据一一对应。
     把这些搬进库 = 与代码脱钩,一次误改就能打出"点不开的菜单"。
   - **本表只存覆盖**:人能改的四件事 —— 名称 `title`、上级 `parent_code`、排序 `seq`、隐藏 `hidden`;
     以及管理员在界面上新建的分组(`is_new=1`,代码基线里没有这个节点)。
     合并口径唯一真源 = `frontend/src/business/menuOverrides.js`(有覆盖行的取本表,没有的取代码)。
   - **为什么保存时整表重写**(后端 `MenuNodeService.replaceAll` 先删后插):菜单是一个**有序树**,
     挪一个位置要动一排 seq,逐行 upsert 会让"中间态"可被读到、也容易留下半棵树的脏数据。
     一次事务内整体替换 = 要么全生效、要么全不变。
   - **为什么允许隐藏而不是删除**:删掉代码里有的菜单会让"点不开"变成"找不到",排查成本更高;
     隐藏后导航不渲染,但设计器里仍能看到并恢复。

   幂等:建表/索引/注明全部判存在;可重复执行(不动已有覆盖数据)。
   两账套都执行(正式 HSDZ_MES 先、测试 HSDZ_MES_TEST 后),已登记进 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- 1. 菜单覆盖表 ---------- */
IF OBJECT_ID('dbo.yj_menu_node','U') IS NULL
CREATE TABLE dbo.yj_menu_node (
  id           int IDENTITY(1,1) NOT NULL CONSTRAINT PK_yj_menu_node PRIMARY KEY,
  menu_code    nvarchar(64)   NOT NULL,          -- 节点编码(与 menus.js 的 node.code 对应;新建分组自定义)
  parent_code  nvarchar(64)   NULL,              -- 上级节点编码(NULL = 一级模块)
  title        nvarchar(100)  NOT NULL,          -- 显示名称(导航与单据查询都按它显示)
  seq          int            NOT NULL CONSTRAINT DF_yj_menu_node_seq DEFAULT 0,     -- 同级排序(升序)
  hidden       bit            NOT NULL CONSTRAINT DF_yj_menu_node_hidden DEFAULT 0,  -- 是否在导航中隐藏
  is_new       bit            NOT NULL CONSTRAINT DF_yj_menu_node_isnew DEFAULT 0,   -- 1 = 界面新建的分组(代码基线无此节点)
  icon         nvarchar(50)   NULL,              -- 新建分组的图标名(Element Plus 图标组件名)
  operator     nvarchar(50)   NULL,              -- 最后一次保存的操作人
  updated_at   datetime2      NULL,              -- 最后一次保存时间
  asp_user1    nvarchar(50)   NULL,
  asp_time1    datetime2      NULL,
  asp_user2    nvarchar(50)   NULL,
  asp_time2    datetime2      NULL
);
GO
IF OBJECT_ID('dbo.yj_menu_node','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_yj_menu_node_code' AND object_id = OBJECT_ID('dbo.yj_menu_node'))
  CREATE UNIQUE INDEX UX_yj_menu_node_code ON dbo.yj_menu_node(menu_code);
GO
IF OBJECT_ID('dbo.yj_menu_node','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_yj_menu_node_parent' AND object_id = OBJECT_ID('dbo.yj_menu_node'))
  CREATE INDEX IX_yj_menu_node_parent ON dbo.yj_menu_node(parent_code, seq);
GO

/* ---------- 2. 中文注明(表级 + 列级,幂等) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.yj_menu_node') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'菜单覆盖表(系统管理平台·菜单设计):只存人能改的名称/上级/排序/隐藏,导航基线与数据键仍在代码 menus.js',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_menu_node';
GO
DECLARE @c TABLE (col sysname PRIMARY KEY, descr nvarchar(200));
INSERT INTO @c (col, descr) VALUES
 (N'id',          N'主键(自增)'),
 (N'menu_code',   N'节点编码(与代码基线 menus.js 的 node.code 对应;界面新建的分组用自定义编码)'),
 (N'parent_code', N'上级节点编码(空 = 一级模块;指向不存在的节点时按一级处理,不丢菜单)'),
 (N'title',       N'显示名称(导航/单据查询按它显示;多语言由翻译表按中文原文自动补齐)'),
 (N'seq',         N'同级排序(升序;保存时按界面顺序整体重写)'),
 (N'hidden',      N'是否在导航中隐藏(1=不显示,仍保留在设计器里可恢复)'),
 (N'is_new',      N'是否界面新建的分组(1=代码基线没有这个节点,由菜单设计器创建)'),
 (N'icon',        N'新建分组的图标名(Element Plus 图标组件名;基线节点图标取自代码)'),
 (N'operator',    N'最后一次保存的操作人'),
 (N'updated_at',  N'最后一次保存时间'),
 (N'asp_user1',   N'创建人'),
 (N'asp_time1',   N'创建时间'),
 (N'asp_user2',   N'最后修改人'),
 (N'asp_time2',   N'最后修改时间');
DECLARE @col sysname, @d nvarchar(200);
DECLARE cur1 CURSOR FAST_FORWARD LOCAL FOR SELECT col, descr FROM @c;
OPEN cur1; FETCH NEXT FROM cur1 INTO @col, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 JOIN sys.columns cl ON cl.object_id = ep.major_id AND cl.column_id = ep.minor_id
                 WHERE ep.major_id = OBJECT_ID('dbo.yj_menu_node') AND ep.name = N'MS_Description' AND cl.name = @col)
    EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'yj_menu_node', N'COLUMN', @col;
  FETCH NEXT FROM cur1 INTO @col, @d;
END
CLOSE cur1; DEALLOCATE cur1;
GO

/* ---------- 自检 ---------- */
DECLARE @t int = (SELECT COUNT(*) FROM sys.tables WHERE name = N'yj_menu_node');
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_menu_node'));
DECLARE @ix int = (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.yj_menu_node') AND name IN (N'UX_yj_menu_node_code', N'IX_yj_menu_node_parent'));
IF @t <> 1 OR @cols < 14 OR @ix <> 2
  RAISERROR(N'[FAIL] 菜单覆盖表未就绪(表 %d、列 %d、索引 %d/2)', 16, 1, @t, @cols, @ix);
DECLARE @noDesc int = (SELECT COUNT(*) FROM sys.columns cl
                        WHERE cl.object_id = OBJECT_ID('dbo.yj_menu_node')
                          AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                                          WHERE ep.major_id = cl.object_id AND ep.minor_id = cl.column_id AND ep.name = N'MS_Description'));
IF @noDesc <> 0 RAISERROR(N'[FAIL] yj_menu_node 仍有 %d 个列缺中文注明', 16, 1, @noDesc);
RAISERROR(N'[OK] 菜单设计就绪:yj_menu_node(空表 = 全部按代码基线显示)', 10, 1) WITH NOWAIT;
GO
