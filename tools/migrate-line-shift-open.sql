-- migrate-line-shift-open.sql — 排产按「生产线」组织 + 开线管理(参考系统工单排产页范式;2026-09-23 去班别)
-- 依据:用户参考截图(ProSchedulingController 工单排产):左侧=各线 未交量汇总+开线状态(是/否),
--   选中线 → 右侧展示该线的排产明细(未完工/已完工筛选);排产动作=排到当前选中的线。
-- 2026-09-23 用户拍板:**不要白班/夜班维度**——骨架=基础资料生产线档案(含停用线,停用=不可排新单仅可查看)。
-- 本脚本:①开线表 bs_line_open(日期×生产线 唯一);②无其它结构变更(排产班组列已在,取值=班组档案)。
-- 幂等:IF OBJECT_ID/IF NOT EXISTS,可重复执行。
SET NOCOUNT ON;

IF OBJECT_ID('bs_line_open') IS NULL
CREATE TABLE bs_line_open (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [开工日期] date NOT NULL,
  [生产线] nvarchar(100) NOT NULL,
  [开线] bit NOT NULL DEFAULT 0,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL
);
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('bs_line_open') AND name='班别')
  DROP INDEX ux_bs_line_open ON bs_line_open;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('bs_line_open') AND name='班别')
  ALTER TABLE bs_line_open DROP COLUMN 班别;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_bs_line_open' AND object_id=OBJECT_ID('bs_line_open'))
  CREATE UNIQUE INDEX ux_bs_line_open ON bs_line_open([开工日期],[生产线]);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_line_open') AND ep.minor_id=0 AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'产线开班表(日×线 是否开线;工单排产左侧骨架,未交量汇总与查看的前提展示)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_line_open';

SELECT N'bs_line_open 表' AS 检查, COUNT(*) FROM sys.tables WHERE name='bs_line_open';
PRINT N'migrate-line-shift-open 完成';
GO
