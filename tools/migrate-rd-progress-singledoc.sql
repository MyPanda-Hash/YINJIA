-- migrate-rd-progress-singledoc.sql
-- 项目进度查询(RD_PROGRESS)登记为「单单据面板」:yj_panel.config 里补 "singleDoc": true
-- 幂等;两个账套都要执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)
--
-- 判定真源 = PanelConfigService.panelSingleDoc():读 yj_panel.config,去空白后字符串匹配 "singleDoc":true
--   (库兼容级别 100,不用 JSON_VALUE)。命中后 metadata.singleDoc=true ⇒ 前端 singleDocMode 生效 ⇒
--   PanelxList.vue:62 工具栏(含「新增」)整块不渲染;:3204 侧栏动作组排除 新增/新增流程/新建。
-- 该方法的注释原本就写着「项目进度查询(RD_PROGRESS)即用它」—— 设计意图早就在,只是元数据一直没登记。
--
-- ⚠ 只改 config;不动 doc 状态机(草稿/已审核/归档流程不变)。
-- ⚠ 无 CASE、无字符串拼接进 CASE —— 用两条朴素 UPDATE 表达同一逻辑(上一版 CASE 里 DB 报语法错)。
SET NOCOUNT ON;
GO

-- ① config 为空 → 直接给一个只含 singleDoc 的 JSON
UPDATE yj_panel SET config = N'{"singleDoc":true}'
WHERE panel_code = N'RD_PROGRESS' AND ISNULL(config, N'') = N'';
PRINT N'[OK] 空 config 已补,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ② config 是 JSON 对象但不含该键 → 在右花括号前插入
UPDATE yj_panel SET config = LEFT(LTRIM(RTRIM(config)), LEN(LTRIM(RTRIM(config))) - 1) + N',"singleDoc":true}'
WHERE panel_code = N'RD_PROGRESS'
  AND ISNULL(config, N'') <> N''
  AND LTRIM(RTRIM(config)) LIKE N'{%}'
  AND REPLACE(REPLACE(REPLACE(ISNULL(config, N''), N' ', N''), CHAR(10), N''), CHAR(13), N'') NOT LIKE N'%"singleDoc":true%';
PRINT N'[OK] 已有 config 补键,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ③ 自检:把最终 config 原样报出来(RAISERROR —— DbSync 吞 PRINT)
DECLARE @cfg nvarchar(400);
SELECT TOP 1 @cfg = CONVERT(nvarchar(400), config) FROM yj_panel WHERE panel_code = N'RD_PROGRESS';
IF @cfg IS NULL
  RAISERROR(N'SELFCHECK FAIL: RD_PROGRESS 不存在或 config 为 NULL', 16, 1);
ELSE IF REPLACE(REPLACE(REPLACE(@cfg, N' ', N''), CHAR(10), N''), CHAR(13), N'') LIKE N'%"singleDoc":true%'
  RAISERROR(N'SELFCHECK OK  RD_PROGRESS config = %s', 16, 1, @cfg);
ELSE
  RAISERROR(N'SELFCHECK FAIL  config 仍不含 singleDoc:true = %s', 16, 1, @cfg);
GO
