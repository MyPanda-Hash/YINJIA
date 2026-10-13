-- migrate-whloc-fix-dup-zone-field-20261008.sql
-- 修复:WHLOC 面板出现**重复的「存储分区」列**(2026-10-08 用户报障:仓位明细里「存储分区」列出现两次)
--
-- 【根因(已实锤,yj_schema_log 时间线)】
--   migrate-whloc-area-a-raw-20261008.sql §3 用 `IF NOT EXISTS (... col_name=N'库区')` 守卫注册「库区」字段,
--   但同链后续的 migrate-whloc-clean-coord-20261008.sql §2 把该列**改名成「存储分区」**(col_name+label 一起改)。
--   于是 area-a-raw **一旦重跑**,守卫就再也找不到「库区」⇒ **又插一行「库区」**;紧接着 clean-coord 又把它改名成
--   「存储分区」⇒ 同面板出现两行 (col_name='存储分区', label='存储分区') ⇒ 网格渲染出**两列同名**。
--   正式库实测:zonepick 15:23:48 跑完 → area-a-raw 16:04:52 重跑 → clean-coord 16:04:52.66 重跑 ⇒ 多一行 id=16157(seq 34,类型仍是「文本」)。
--   测试库更甚:该对脚本重跑了**两次** ⇒ 多两行(id 7408/7410)。
--   ⚠ 这正是 AGENTS.md 反复警告的「历史脚本重跑撞 schema 演进」;教训见本脚本末尾与「数据库规范.md §4.2」。
--
-- 【本脚本做什么】
--   1. 删除 WHLOC 内**同 (col_name,label) 的重复登记行**,只保留 id 最小的那一行(即最初的正确登记);
--   2. 把幸存的「大区 / 存储分区」两行规范化(类型=分区选择、序号、位置、宽度、可见性),
--      同时补上 migrate-whloc-zonepick 那次因命中重复行而**漏改的 data_type**(幸存行原本仍是「文本」);
--   3. 自检:重复组数为 0、两字段类型为「分区选择」、字段集与期望清单一致。
--
-- 【幂等】按 (col_name,label) 分组取 MIN(id) 删其余 ⇒ 已无重复时删 0 行;规范化是定值 UPDATE。
-- 【不改什么】不碰其它面板的重复登记行(那些属既有存量,体检 07 项单独记账);不动 bs_wh_loc 数据。
-- 【执行】两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 删除重复登记行(同 panel_code + col_name + label,保留 MIN(id)) ══════════
DECLARE @del int;
WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY col_name, label ORDER BY id) AS rn
  FROM yj_field
  WHERE panel_code = N'WHLOC'
)
DELETE FROM yj_field WHERE id IN (SELECT id FROM dup WHERE rn > 1);
SET @del = @@ROWCOUNT;
PRINT N'  ✓ 删除 WHLOC 重复字段登记行 ' + CAST(@del AS nvarchar(10)) + N' 行';
GO

-- ══════════ 2. 规范化(补回被重复行"吃掉"的那次类型修改) ══════════
UPDATE yj_field SET data_type = N'分区选择', place = N'query,detail', seq = 34, width = 110,
                    visible = 1, hidden = 0, editable = 1
WHERE panel_code = N'WHLOC' AND col_name = N'大区';

UPDATE yj_field SET data_type = N'分区选择', place = N'query,detail', seq = 36, width = 110,
                    visible = 1, hidden = 0, editable = 1
WHERE panel_code = N'WHLOC' AND col_name = N'存储分区';
GO

-- ══════════ 3. 自检 ══════════
SELECT N'重复登记组数(应 0)' AS 检查项, CAST(COUNT(*) AS nvarchar(10)) AS 值
  FROM (SELECT col_name, label FROM yj_field WHERE panel_code = N'WHLOC'
        GROUP BY col_name, label HAVING COUNT(*) > 1) t
UNION ALL SELECT N'存储分区 行数(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = N'WHLOC' AND col_name = N'存储分区'
UNION ALL SELECT N'大区 行数(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = N'WHLOC' AND col_name = N'大区'
UNION ALL SELECT N'两字段类型非分区选择的行数(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field
  WHERE panel_code = N'WHLOC' AND col_name IN (N'大区', N'存储分区') AND data_type <> N'分区选择'
UNION ALL SELECT N'WHLOC 字段行数', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = N'WHLOC'
UNION ALL SELECT N'元数据漂移:字段无对应物理列的行数(应 0)', CAST(COUNT(*) AS nvarchar(10))
  FROM yj_field f WHERE f.panel_code = N'WHLOC' AND COL_LENGTH('dbo.bs_wh_loc', f.col_name) IS NULL;
GO

SELECT N'—— WHLOC 字段集(按 seq,应与期望清单逐项一致) ——' AS 字段集, N'' AS a, N'' AS b, N'' AS c;
SELECT seq, col_name AS 物理列, label AS 标签, data_type AS 类型, place, visible, hidden
FROM yj_field WHERE panel_code = N'WHLOC' ORDER BY seq, id;
GO
PRINT N'migrate-whloc-fix-dup-zone-field-20261008 完成';
GO
