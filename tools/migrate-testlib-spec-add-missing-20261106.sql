-- migrate-testlib-spec-add-missing-20261106.sql — 规格书检验项目标准库：补齐《测试项目汇总.xlsx》里库里还没有的 8 项
--
-- 用户口径(2026-11-06):上一步 migrate-testlib-spec-order-20261106.sql 只把**库里已有的 18 组**按 Excel 序号重排；
--   用户看到「Excel 有 26 项、库里只有 18 组」后一句「补」⇒ 本脚本按 Excel 原文补入缺的 8 项:
--     7 黄水测试 · 10 浸泡口感测试 · 12 COD性能测试 · 13 阻垢性能测试 · 14 抑菌性能测试 ·
--     15 过流杀菌性能测试 · 16 碱性性能测试 · 17 矿化（富锶或微矿化）性能测试
--
-- 内容来源(逐字):附件《测试项目汇总.xlsx》sheet「规格书检验项目汇总」第 18 / 23 / 26~37 行
--   (C=检验项目、D=子项目、E=检验要求、F=检验方法、G=检验依据)；唯一改写是把「矿化（富锶或微矿化）\n性能测试」
--   那个换行去掉,与序号映射表里的组名一致。
--   ⚠ 检验要求里的 ** / **L / **% 是 Excel 里的**占位符**(每个产品填自己的值),不是笔误,原样保留 ——
--     与库里既有 18 组不同:那 18 组是某个具体产品的定稿值(47.5-49.2g / 34.5±0.5mm 之类)。
--
-- seq = Excel 序号*100 + 组内第 k 条*10(与 migrate-testlib-spec-order-20261106.sql 同一口径)⇒ 插进去即按 Excel 归位,
--   不必再跑重排脚本;日后真跑了重排脚本,结果也一致(幂等)。
-- 幂等:**组级**去重 —— 某组名在库里只要已有任意条目,整个组跳过(不往里塞 Excel 的子项)。
--   为什么不用行级去重:生产库实测 spec.test 已有「COD性能测试(4 条)」「抑菌性能测试(2 条)」等同名组,
--   它们的内容是本厂口径、跟 Excel 模板不同;行级去重会把 Excel 的「初始COD去除率/COD寿命」塞进人家那套里,
--   变成一组两种来源。组级守卫下,这些组原样不动,只补库里**完全没有**的项。
-- 适用:本地/生产通用(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST,见 AGENTS.md「两账套纪律」)。
-- 运行:cd tools && java -cp lib/mssql-jdbc.jar SqlRunner.java <url> yinjia <pw|env> migrate-testlib-spec-add-missing-20261106.sql

IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- 7 黄水测试（1 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'黄水测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'黄水测试', 710, N'{"v":2,"group":"黄水测试","name":"","req":"初始：无肉眼可见黄水\n浸泡隔夜（12-16H）：无肉眼可见黄水","method":"将炭棒组装好装入滤瓶（可旋盖大T），按进水方向通水，测试用水为纯水/超纯水，测试流速**±0.1L/min，\n1.初始黄水：用烧杯（白纸垫底部）接第一杯水**ml，观察出水颜色。\n2.浸泡黄水：冲水5min后，炭棒静置浸泡过夜，用烧杯（白纸垫底部）接第一杯出水**mL，观察出水颜色；","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 10 浸泡口感测试（1 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'浸泡口感测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'浸泡口感测试', 1010, N'{"v":2,"group":"浸泡口感测试","name":"","req":"浸泡24H，口感正常无异味","method":"将炭棒组装好装入**工装，按进水方向通RO纯水，测试流速**±0.1L/min,冲水10min后，浸泡24H后，接出水，测试口感\n品尝人数：至少4人","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 12 COD性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'COD性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'COD性能测试', 1210, N'{"v":2,"group":"COD性能测试","name":"初始COD去除率","req":"≥**%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，先用自来水冲水10min，测试流速**±0.1L/min，用单宁酸加标，浓度控制在3-5mg/L，通入加标水5min后取样测试，计算去除率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'COD性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'COD性能测试', 1220, N'{"v":2,"group":"COD性能测试","name":"COD寿命","req":"自来水点加标\n寿命**L，COD去除率 ≥25%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用银嘉自来水冲水，测试流速**±0.1L/min，用单宁酸加标，浓度控制在3-5mg/L，在寿命终点**L取样测试，计算去除率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 13 阻垢性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'阻垢性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'阻垢性能测试', 1310, N'{"v":2,"group":"阻垢性能测试","name":"初始阻垢率","req":"≥95%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，先用自来水冲洗10min，测试流速**±0.1L/min，按照国家标准方法（GB34914-2021净水机水效限定值及水效等级 附录A）配制加标硬水，通入加标水5min后取样测试，计算阻垢率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'阻垢性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'阻垢性能测试', 1320, N'{"v":2,"group":"阻垢性能测试","name":"阻垢寿命","req":"自来水点加标\n寿命**L，阻垢率 ≥25%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用银嘉自来水冲水，测试流速**±0.1L/min，按照国家标准方法（GB34914-2021净水机水效限定值及水效等级 附录A）配制加标硬水，在寿命终点**L取样测试，计算阻垢率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 14 抑菌性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'抑菌性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'抑菌性能测试', 1410, N'{"v":2,"group":"抑菌性能测试","name":"初始抑菌率","req":"≥99%","method":"将炭棒破碎后，参考《ASTME2149-13a（振荡接触 24 小时）》方法，测试初始抑菌率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'抑菌性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'抑菌性能测试', 1420, N'{"v":2,"group":"抑菌性能测试","name":"抑菌寿命","req":"寿命**L，抑菌率≥90%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用银嘉纯水冲水**L，测试流速**±0.1L/min，\n将冲完水的炭棒烘干后破碎，参考《ASTME2149-13a（振荡接触 24 小时）》方法测试抑菌率","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 15 过流杀菌性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'过流杀菌性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'过流杀菌性能测试', 1510, N'{"v":2,"group":"过流杀菌性能测试","name":"初始杀菌率","req":"≥**%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，测试流速**±0.1L/min，配制大肠杆菌浓度约10000~50000cfu/ml加标液，通入加标水5min后取样测试，计算杀菌率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'过流杀菌性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'过流杀菌性能测试', 1520, N'{"v":2,"group":"过流杀菌性能测试","name":"杀菌寿命","req":"寿命**L，杀菌率≥**%","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用纯水冲水，测试流速**±0.1L/min，配制大肠杆菌浓度约10000~50000cfu/ml，在寿命终点**L取样测试，计算杀菌率。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 16 碱性性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'碱性性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'碱性性能测试', 1610, N'{"v":2,"group":"碱性性能测试","name":"初始碱性效果","req":"初始PH增加值：＞**","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用纯水测试，测试流速**±0.1L/min,通水5min后取样测试。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'碱性性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'碱性性能测试', 1620, N'{"v":2,"group":"碱性性能测试","name":"碱性寿命","req":"寿命**L，PH增加值≥**","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用纯水测试，测试流速**±0.1L/min,在寿命终点**L取样测试。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 17 矿化（富锶或微矿化）性能测试（2 条）

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'矿化（富锶或微矿化）性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'矿化（富锶或微矿化）性能测试', 1710, N'{"v":2,"group":"矿化（富锶或微矿化）性能测试","name":"初始含量含量","req":"≥**mg/L","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用纯水测试，测试流速**±0.1L/min,通水5min后取样测试。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
             AND item_code = N'矿化（富锶或微矿化）性能测试')
  INSERT INTO yj_std_lib (lib_code, item_code, seq, content, enabled, asp_user1, asp_time1)
  VALUES (N'spec.test', N'矿化（富锶或微矿化）性能测试', 1720, N'{"v":2,"group":"矿化（富锶或微矿化）性能测试","name":"矿化寿命","req":"≥**mg/L","method":"将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，水流方向外进内出，用纯水测试，测试流速**±0.1L/min,在寿命终点**L取样测试。","basis":"银嘉测试标准"}', 1, N'seed', SYSDATETIME());
GO

-- 自检①:补进来的 8 组逐条(组名 / seq / 子项名),应与 Excel 第 7·10·12~17 项的位置一致
SELECT item_code AS lib_group, seq, ISNULL(JSON_VALUE(content, N'$.name'), N'') AS sub_name
FROM yj_std_lib
WHERE lib_code = N'spec.test'
  AND item_code IN (N'黄水测试', N'浸泡口感测试', N'COD性能测试', N'阻垢性能测试',
                    N'抑菌性能测试', N'过流杀菌性能测试', N'碱性性能测试', N'矿化（富锶或微矿化）性能测试')
ORDER BY seq, id;

-- 自检②:spec.test 现状(期望:26 组 / 61 条 = 原 47 + 新 14)
SELECT COUNT(*) AS total_rows, COUNT(DISTINCT item_code) AS total_groups
FROM yj_std_lib WHERE lib_code = N'spec.test';

-- 自检③:按 seq 排出前端弹窗的组序(与《测试项目汇总.xlsx》序 号一致)
SELECT MIN(seq) AS min_seq, item_code AS lib_group, COUNT(*) AS sub_rows
FROM yj_std_lib WHERE lib_code = N'spec.test'
GROUP BY item_code ORDER BY MIN(seq);
GO
