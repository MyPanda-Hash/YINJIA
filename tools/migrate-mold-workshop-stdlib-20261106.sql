-- migrate-mold-workshop-stdlib-20261106.sql — 「生产车间」统一成标准库 mold.workshop（1#~7#，可增删维护）
--
-- 用户口径(2026-11-06)原文：
--   「把烧结工艺清单的生产车间换成和X烧结工艺清单的生产车间的内容一样，
--     再把这两个做成标准库可以更新维护，标准库是可以增加，删除的」
--
-- 改前实测：
--   · RD_MOLD_PROC.生产车间    = 参照 DEPT（部门档案，显示 部门名称）→ 选的是「烧结车间/组装车间」这类部门；
--   · RD_MOLD_FORMULA.生产车间 = 参照 DEPT（同上）；⚠ 这一格的纸面在**烧结工艺清单的「成型配方」页**上
--     （recordSheetConfigs: sections: [...RD_MOLD_PROC_SEC0, ...RD_MOLD_FORMULA.sections]），
--     所以「烧结工艺清单的生产车间」实际有两处，必须一起改，否则切页签会看到两种下拉；
--   · RD_X_SINTER.生产车间     = 下拉框，dict_sql 里写死内联 VALUES ('1#'..'7#') → 内容对但不可维护。
--
-- 改法：三处统一改成 **标准库** data_type='标准库' + dict_sql='mold.workshop'；
--   条目落在 yj_std_lib（lib_code='mold.workshop'，item_code='默认'，content=1#~7#，与 asm.form/prod.form 同构），
--   前端当场出现下拉 + 「⧉ 标准库维护」入口（StdLibManager：新增/编辑/停用/恢复启用/彻底删除）。
--   以后再增减车间只动标准库，不碰元数据、不发版。
--
-- 幂等：条目按 lib+item+content 去重；字段 UPDATE 带窄条件 + 行数守卫（期望 3 行）。
-- 数据：两张头表的 生产车间 现值实测为空（本地与生产均 NULL），无需回填；历史若有值按原文本保留
--       （标准库下拉是 filterable+allow-create，旧值不会丢）。
-- 适用：本地/生产通用（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。

IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 1. 标准库条目：生产车间/窑位 1#~7#（与 X烧结 原来那七个值一致） ──────────
DECLARE @lib NVARCHAR(100) = N'mold.workshop';
DECLARE @vals TABLE (v NVARCHAR(50) NOT NULL PRIMARY KEY, seq INT NOT NULL);
INSERT INTO @vals (v, seq) VALUES (N'1#',10),(N'2#',20),(N'3#',30),(N'4#',40),(N'5#',50),(N'6#',60),(N'7#',70);

INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
SELECT @lib, N'默认', v.seq, v.v, 1, N'seed', SYSDATETIME()
FROM @vals v
WHERE NOT EXISTS (
  SELECT 1 FROM yj_std_lib x
  WHERE x.lib_code = @lib AND x.item_code = N'默认' AND x.content = v.v
);
GO

-- ── 2. 三处字段改标准库（保留原 seq/place/width，只换取值来源） ─────────────
-- 期望行数 = 本库里**真实存在**这几个面板的「生产车间」字段数(不是写死 3):
--   测试账套 HSDZ_MES_TEST 是旧快照,连 RD_X_SINTER 面板都还没有(实测该面板 yj_field 0 行)——
--   写死 3 会让陈旧测试库直接 FAIL,而正式库的守卫不能因此放松。
DECLARE @n INT, @expect INT;
SELECT @expect = COUNT(DISTINCT panel_code) FROM yj_field
WHERE label = N'生产车间' AND panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA', N'RD_X_SINTER');

UPDATE yj_field
SET data_type = N'标准库', dict_sql = N'mold.workshop',
    ref_panel = NULL, ref_field = NULL, display_field = NULL
WHERE label = N'生产车间' AND panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA', N'RD_X_SINTER');
SET @n = @@ROWCOUNT;

IF @expect = 0 RAISERROR(N'[FAIL] 本库没有 RD_MOLD_PROC/RD_MOLD_FORMULA/RD_X_SINTER 的「生产车间」字段', 12, 1) WITH NOWAIT;
IF @n <> @expect RAISERROR(N'[FAIL] 生产车间改标准库命中 %d 行(本库应有 %d 行)', 12, 1, @n, @expect) WITH NOWAIT;
IF @expect < 3 RAISERROR(N'[SKIP] 本库缺部分面板(旧快照),已按实际存在 %d 处改到位', 10, 1, @expect) WITH NOWAIT;
GO

-- ── 3. 自检 ────────────────────────────────────────────────────────────────
IF (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N'mold.workshop' AND ISNULL(enabled,1) = 1) < 7
  RAISERROR(N'[FAIL] mold.workshop 启用条目不足 7 条', 12, 1) WITH NOWAIT;
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE label = N'生产车间'
           AND panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA', N'RD_X_SINTER')
           AND data_type IS NOT NULL
           AND (data_type <> N'标准库' OR ISNULL(dict_sql,N'') <> N'mold.workshop'))
  RAISERROR(N'[FAIL] 仍有面板的 生产车间 不是标准库 mold.workshop', 12, 1) WITH NOWAIT;
GO

SELECT panel_code, label, data_type, dict_sql, seq FROM yj_field
WHERE label = N'生产车间' AND panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA', N'RD_X_SINTER') ORDER BY panel_code;
GO
SELECT lib_code, item_code, seq, content, enabled FROM yj_std_lib WHERE lib_code = N'mold.workshop' ORDER BY seq;
GO
RAISERROR(N'[PASS] 烧结工艺清单(含成型配方页)/X烧结工艺清单 的「生产车间」已统一为标准库 mold.workshop（1#~7#）', 10, 1) WITH NOWAIT;
GO
