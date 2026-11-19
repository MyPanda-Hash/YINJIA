-- migrate-filter-eff-dyncols-visible-20261120.sql
-- 功能性滤效「3.数据记录表」（RD_FILTER_EFF）动态样品列：清除把「出水含量 / 去除率」样品2..6 置隐藏的历史脏偏好。
--
-- 【根因 · 2026-11-20 生产实测（只读取证，见 tools/archive/_filtereff-20261120/evidence.md）】
--   用户报：点右上角「样品列 ＋/－」时，只有「取样前样品」跟着增删，
--           「出水含量（ug/L）」与「去除率%」两组永远只剩「样品1」（连报两次）。
--   代码层三组都是 v-for="n in sampleCount"（表头/表体/colgroup 各一套），本地 vite 用本地库
--   （同 10 行 visible=1）复现不了；生产库才是病根：
--     SELECT id, col_name, label, place, seq, hidden, visible FROM yj_field
--      WHERE panel_code='RD_FILTER_EFF' AND place='detail' ...
--   ⇒ 出水样品2 / 出水含量（ug/L）样品3..6 / 去除率样品2 / 去除率%样品3..6 共 10 行
--     hidden=1、visible=0；而 压力（PSI)样品1..6、流速（L/min)样品1..6 全 visible=1。
--   元数据下发时 dataName = yj_field.label、visible=false（PanelConfigService.fieldSpec），
--   前端 dtHidden() 因此为真，那两组只渲染样品1 —— 与「样品数」彻底脱钩。
--   来源是历史「表格调整 / 字段编辑」留下的脏偏好（2026-11-13 角色字段视图上线前的旧通道），
--   不是 seed：tools/migrate-rd-filter-eff.sql 里这 10 行初始就是 hidden=0/visible=1。
--
-- 【本次配套】
--   ① 代码护栏（同批 fix）：frontend/core/sheet/columnPrefs.isColumnHiddenFor —— 动态样品列恒显示，
--      任何列偏好（yj_field.visible / yj_role 字段视图）都藏不住它们；字段编辑里显隐开关已禁用。
--   ② 本脚本：把这 10 行的 hidden/visible 归位（幂等；只动这 10 个 label）。
--
-- 幂等：重复执行影响 0 行。范围仅 RD_FILTER_EFF + place='detail' + 下面 10 个 label，
--       不新增/不删除行，不动其它面板、不动压力/流速（它们本来就正常）。
-- 运行：java -cp lib/mssql-jdbc.jar DbSync.java run migrate-filter-eff-dyncols-visible-20261120.sql
--       （或 sqlcmd -f 65001；脚本 UTF-8 无 BOM）
SET NOCOUNT ON;
GO

DECLARE @target TABLE (label nvarchar(200) PRIMARY KEY);
INSERT INTO @target (label) VALUES
  (N'出水含量（ug/L）样品2'),
  (N'出水含量（ug/L）样品3'),
  (N'出水含量（ug/L）样品4'),
  (N'出水含量（ug/L）样品5'),
  (N'出水含量（ug/L）样品6'),
  (N'去除率%样品2'),
  (N'去除率%样品3'),
  (N'去除率%样品4'),
  (N'去除率%样品5'),
  (N'去除率%样品6');

DECLARE @beforeRows int, @beforeHidden int, @outsideHidden int;
SELECT @beforeRows = COUNT(*)
  FROM yj_field f JOIN @target t ON t.label = f.label
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail';
SELECT @beforeHidden = COUNT(*)
  FROM yj_field f JOIN @target t ON t.label = f.label
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail'
   AND (f.hidden = 1 OR f.visible = 0);
-- 越界基线：本面板 detail 里目标 10 行之外的隐藏行数（本脚本不许改动它们）
SELECT @outsideHidden = COUNT(*)
  FROM yj_field f
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail'
   AND (f.hidden = 1 OR f.visible = 0)
   AND NOT EXISTS (SELECT 1 FROM @target t WHERE t.label = f.label);
PRINT N'[BEFORE] RD_FILTER_EFF/detail 目标行 = ' + CAST(@beforeRows AS nvarchar(10))
    + N'，其中隐藏 = ' + CAST(@beforeHidden AS nvarchar(10))
    + N'；范围外隐藏行 = ' + CAST(@outsideHidden AS nvarchar(10));

IF @beforeRows > 0
BEGIN
  DECLARE @fixed int;
  UPDATE f
     SET f.hidden = 0,
         f.visible = 1
    FROM yj_field f
    JOIN @target t ON t.label = f.label
   WHERE f.panel_code = N'RD_FILTER_EFF'
     AND f.place = N'detail'
     AND (f.hidden = 1 OR f.visible = 0);
  SET @fixed = @@ROWCOUNT;
  PRINT N'[FIXED] 归位行数 = ' + CAST(@fixed AS nvarchar(10));
END
ELSE
  PRINT N'[SKIP] 目标行在本库不存在（RD_FILTER_EFF/detail 未登记这 10 个 label），无动作';

-- ── 自检 ──
DECLARE @afterRows int, @afterHidden int, @afterOutsideHidden int;
SELECT @afterRows = COUNT(*)
  FROM yj_field f JOIN @target t ON t.label = f.label
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail';
SELECT @afterHidden = COUNT(*)
  FROM yj_field f JOIN @target t ON t.label = f.label
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail'
   AND (f.hidden = 1 OR f.visible = 0);
SELECT @afterOutsideHidden = COUNT(*)
  FROM yj_field f
 WHERE f.panel_code = N'RD_FILTER_EFF' AND f.place = N'detail'
   AND (f.hidden = 1 OR f.visible = 0)
   AND NOT EXISTS (SELECT 1 FROM @target t WHERE t.label = f.label);

PRINT N'[AFTER ] 目标行 = ' + CAST(@afterRows AS nvarchar(10))
    + N'，其中隐藏 = ' + CAST(@afterHidden AS nvarchar(10))
    + N'；范围外隐藏行 = ' + CAST(@afterOutsideHidden AS nvarchar(10));

IF @afterHidden > 0
  RAISERROR(N'[FAIL] 仍隐藏的动态样品列 %d 行（脚本应把 hidden/visible 归位）', 16, 1, @afterHidden);
IF @afterRows <> @beforeRows
  RAISERROR(N'[FAIL] 目标行数变了（before=%d after=%d），脚本不许增删行', 16, 1, @beforeRows, @afterRows);
IF @afterOutsideHidden <> @outsideHidden
  RAISERROR(N'[FAIL] 越界：范围外隐藏行数从 %d 变成 %d，脚本动了不该动的行', 16, 1, @outsideHidden, @afterOutsideHidden);
PRINT N'[PASS] 动态样品列 hidden/visible 已归位；越界改动 = 0';
GO
