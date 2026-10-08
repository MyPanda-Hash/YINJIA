-- migrate-whloc-zonepick-20261008.sql — 仓位「大区 / 存储分区」改为「分区选择」型(候选=本表实际数据)
--
-- 【需求】用户 2026-10-08 定稿的方案(方案 A 修正版):
--   「如果存在这个分区是因为我有这个仓位数据,但是我没有这个仓位是不是就没有这个分区了,增加提示即可,
--     让当前的这个分区的仓位存在时就无法删除这个分区,当这个分区的仓位删除完后就会提示当前的分区也一起没了。」
--   ⇒ **分区是仓位数据的派生**,不落任何存储:
--      · 候选 = `SELECT DISTINCT 大区, 存储分区 FROM bs_wh_loc`(含每个分区当前的仓位数)
--      · 「新增」= 在弹窗里填一对新值 → 直接写进当前单元格 → 保存后它自然出现在候选里
--      · 「删除」= **带保护的指引**:该分区还有仓位时给出明确提示 + 一键筛出这些仓位;
--        等这些仓位被改走/删光,分区**自动**从候选消失(因为候选就是数据)。
--   ⇒ 因此:零新表、零新面板、零 DDL、零后端接口,且**删除永远不触碰仓位数据**。
--
-- 【本脚本只做一件事】把 WHLOC 的 大区 / 存储分区 两行的 data_type 由「文本」改成「分区选择」。
--   这是**元数据驱动的开关**:前端见到该类型就把单元格从"行内文本框"换成"点击开分区弹窗"
--   (不在前端硬编码面板名/列名,与引擎既有约定一致)。
--   ⚠ 后端对未知 data_type 是安全的:isNumericType/下拉框/标准库/是否 等判定全部按具体取值比较,
--     `分区选择` 会自然落空(不参与数值合计、不下发 options、不参与「是否」带回闸门);
--     PanelConfigService 只把它原样透传给前端(见 :558/:1237/:1495 的 m.put("dataType", ...))。
--
-- 【不改什么】bs_wh_loc / bs_wh 的列与数据一个字节不动;不加表;不加接口;不碰金蝶的「仓位*」字段。
-- 【幂等】按 (panel_code, label) 定值 UPDATE;可重复执行。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 大区 / 存储分区 → 分区选择 ══════════
DECLARE @n int;
UPDATE yj_field SET data_type = N'分区选择'
WHERE panel_code = N'WHLOC' AND label IN (N'大区', N'存储分区') AND data_type <> N'分区选择';
SET @n = @@ROWCOUNT;
PRINT N'  ✓ WHLOC.大区/存储分区 文本 → 分区选择 (' + CAST(@n AS nvarchar(10)) + N' 行)';
GO

-- ══════════ 2. 列注明补充：说明该列在界面上的取数方式 ══════════
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bs_wh_loc')
           AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_wh_loc'), N'存储分区', 'ColumnId') AND name=N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'存储分区(用途标签 = 《仓库总体规划》列头:炭粉区/胶粉区/货架区/纸箱区/端盖区/PP棉区/无纺布区/网套区/标签区;按(区码,排号区间)切,不是物理层级;2026-10-08 由「库区」正名。**界面取数:yj_field.data_type=分区选择 ⇒ 点格开「仓位分区」弹窗,候选=本表 (大区,存储分区) 去重并集,不落任何存储;分区随仓位存在,仓位没了分区就没了**)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'存储分区';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bs_wh_loc')
           AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_wh_loc'), N'大区', 'ColumnId') AND name=N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'大区(仓内的大功能分区,层次:厂区 > 仓 > 大区 > 分区;取值 原料区/辅料及配件区/成品仓区;B仓/C仓 不分区故为空;2026-10-08 按用户口径新增。**界面取数:同 存储分区,走「仓位分区」弹窗**)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'大区';
GO

-- ══════════ 3. 验证 ══════════
SELECT label AS 字段, data_type AS 类型, place, seq, visible, hidden, editable
FROM yj_field WHERE panel_code = N'WHLOC' AND label IN (N'大区', N'存储分区')
UNION ALL SELECT N'—— 分区候选(由数据派生) ——', N'', N'', NULL, NULL, NULL, NULL;

-- 候选 = 数据派生,这里把弹窗将要展示的内容直接跑一遍
SELECT ISNULL(大区, N'(不分区)') AS 大区, ISNULL(存储分区, N'(不细分)') AS 存储分区, COUNT(*) AS 仓位数
FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 大区, 存储分区 ORDER BY 大区, 存储分区;
GO

SELECT N'分区种类数' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM (
  SELECT DISTINCT ISNULL(大区,N'') AS A, ISNULL(存储分区,N'') AS Z FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y') t
UNION ALL SELECT N'有效仓位数(应 679)', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'bs_wh_loc 列数(应 38,未动)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc');
GO
PRINT N'migrate-whloc-zonepick-20261008 完成';
GO
