-- migrate-testlib-spec-order-20261106.sql — 规格书检验项目标准库(spec.test)的组序按《测试项目汇总.xlsx》重排
--
-- 用户口径(2026-11-06)原文:「把研发管理的规格书的检验项目的标准库里面的内容的排序按这个文件
--   进行排序,里面的数据有点乱排序,不好找对应的在哪里」(附件《测试项目汇总.xlsx》).
--
-- 现状(改前实测):spec.test 47 条 / 18 组,seq=10..470 是 2026-09-20「按《规格书细分.xlsx》
--   重建 18 个检验项目」那次的落库次序,与《测试项目汇总.xlsx》sheet「规格书检验项目汇总」
--   的「序 号」列**不一致**。最典型的一条：
--     「*余氯去除性能」在 Excel 是第 11 项(紧接 10 浸泡口感测试),库里却排在 18 组里的第 17 位
--     (在 NSF401 / 毒杀芬 / MTBE 之后) ⇒ 用户按 Excel 的顺序找,翻不到。
--   其余 17 组的相对次序本来就与 Excel 一致,本次一并按 Excel 序号**重编号**(结果可复现、可核对)。
--
-- 编号口径:Excel 序号 n 的组 → seq 段 n*100;组内第 k 条 → n*100 + k*10(组内原相对次序不变)。
--   · 组序的真源 = 库里的 seq:前端 RecordSheetPanels 取「组内最小 seq」排组
--     (纯函数 core/panel/testItemLib.js `orderSpecGroups`;内置常量 SPEC_TEST_LIB 只作兜底)。
--   · 新条目仍由 StdLibController.add 取「库内最大 seq + 10」⇒ 一律缀在最后,不会被本次重排顶到中间。
--   · 断档的 7/10/12~17 段是留给《测试项目汇总.xlsx》里库里**还没有**的 8 项
--     (黄水测试 · 浸泡口感测试 · COD · 阻垢 · 抑菌 · 过流杀菌 · 碱性 · 矿化)——
--     那 8 项是"某个产品要测什么"的业务内容,本脚本**不造数据**,需要时由用户在弹窗
--     「补充自定义检验项」自行加(加进来会落 max+10,想插回 Excel 位置再跑一次本脚本即可)。
--
-- 幂等:重算只依赖 (item_code → Excel 序号) 与组内 (原 seq, id) 的相对次序,重复执行结果不变。
-- 适用:本地/生产通用(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST,见 AGENTS.md「两账套纪律」)。
-- 运行:cd tools && java -cp lib/mssql-jdbc.jar SqlRunner.java <url> yinjia <pw|env> migrate-testlib-spec-order-20261106.sql

IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

DECLARE @ord TABLE (item_code NVARCHAR(200) NOT NULL PRIMARY KEY, rnk INT NOT NULL);
INSERT INTO @ord (item_code, rnk) VALUES
  (N'*外观',                        1),   -- 1 外观
  (N'*炭棒尺寸',                    2),   -- 2 尺寸(产品尺寸/整体尺寸 → 库内拆成外径/内径/长度三行)
  (N'重量',                         3),   -- 3 重量
  (N'强度',                         4),   -- 4 强度测试
  (N'#*压降',                       5),   -- 5 初始流速及压降测试(库内「压降」单独成组,排在流速之后)
  (N'*黑水及颗粒物测试',            6),   -- 6 黑水及颗粒物测试
  (N'*一级颗粒物去除率',            8),   -- 8 炭棒过滤精度测试(库内只留「一级颗粒物去除率」)
  (N'隔夜浸泡口感/气味',            9),   -- 9 隔夜浸泡口感/气味及浊度测试
  (N'*余氯去除性能',               11),   -- 11 余氯性能测试 ← 本次唯一位置变化的组(原第 17)
  (N'VOC性能测试',                 18),   -- 18 VOC性能测试
  (N'*除铅性能测试（PH8.5&6.5)',   19),   -- 19 *除铅性能测试
  (N'*除汞性能测试（PH8.5&6.5)',   20),   -- 20 *除汞性能测试
  (N'*Cyst去除测试',               21),   -- 21 *Cyst去除测试
  (N'*PFOA&PFOS去除性能测试',      22),   -- 22 *PFOA&PFOS去除性能测试
  (N'*NSF401（三组）去除性能测试', 23),   -- 23 *NSF401（三组）去除性能测试
  (N'*毒杀芬去除性能',             24),   -- 24 *毒杀芬去除性能
  (N'*MTBE去除性能',               25),   -- 25 *MTBE去除性能
  (N'*卫生安全',                   26);   -- 26 卫生浸泡(库内叫「*卫生安全」)

;WITH x AS (
  SELECT l.id,
         newseq = o.rnk * 100 + 10 * ROW_NUMBER() OVER (PARTITION BY l.item_code ORDER BY l.seq, l.id)
  FROM yj_std_lib l
  JOIN @ord o ON o.item_code = l.item_code
  WHERE l.lib_code = N'spec.test'
)
UPDATE l SET seq = x.newseq
FROM yj_std_lib l JOIN x ON x.id = l.id;

-- 自检①:重排后的组序(= 前端弹窗看到的次序)与 Excel 序号逐行对照
SELECT o.rnk AS excel_no, l.item_code AS lib_group, MIN(l.seq) AS min_seq, COUNT(*) AS sub_rows
FROM yj_std_lib l JOIN @ord o ON o.item_code = l.item_code
WHERE l.lib_code = N'spec.test'
GROUP BY o.rnk, l.item_code
ORDER BY o.rnk;

-- 自检②:库里还有 @ord 没覆盖的组(用户自己加的自定义组)——它们会排在末尾,这里点名便于核对
IF EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'spec.test'
           AND item_code NOT IN (SELECT item_code FROM @ord))
BEGIN
  SELECT item_code AS unmapped_group, MIN(seq) AS min_seq, COUNT(*) AS sub_rows
  FROM yj_std_lib WHERE lib_code = N'spec.test'
    AND item_code NOT IN (SELECT item_code FROM @ord)
  GROUP BY item_code ORDER BY MIN(seq);
  RAISERROR(N'[WARN] 上列组不在《测试项目汇总.xlsx》序号映射里(已保留、排末尾)', 10, 1) WITH NOWAIT;
END
ELSE
  RAISERROR(N'[PASS] spec.test 18 组全部命中 Excel 序号映射', 10, 1) WITH NOWAIT;
GO
