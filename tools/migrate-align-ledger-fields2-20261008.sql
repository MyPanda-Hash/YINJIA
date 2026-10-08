-- migrate-align-ledger-fields2-20261008.sql
-- 第二轮:测试库(HSDZ_MES_TEST)字段元数据对齐正式库 —— 补第一轮看不见的 4 处。
-- 依据:docs/development/采购链四单字段与显示字段.md(四单字段与显示字段唯一基线)
--
-- 为什么还有第二轮(第一轮 migrate-align-ledger-fields-20261008.sql 之后剩这 4 处):
--   第一轮的对齐 SQL 由旧版比对器生成,行身份用的是 (panel_code, col_name) —— 而 yj_field 里
--   **同一个字段可以有多行**(既在查询区/表头又在明细页签,place 不同;甚至完全重复),
--   于是旧版把这些行塌成一行来比,漏掉了 4 处:
--     ① PURCHASE_IN.批次号 (query,header)      seq 测试库 255 / 正式库 290     ← 与它的 (detail) 行塌成一行后看不见
--     ② PURCHASE_IN.本次结算金额本位币 (detail) 测试库多一行(重复登记)          ← 键相同被覆盖,数量差看不见
--     ③ QC_RECV.数量 (header)                  hidden/visible 测试库 0/1、正式库 1/0
--     ④ QC_RETURN.批次号 (query,header)         seq 测试库 36 / 正式库 50
--   比对器已修:_YjFieldAlign.java 现在按 (字段, place) 作行身份做**多重集**比较,并把
--   「同一字段多行」这类盲区写进了文件头,防止再犯。
--
-- 怎么发现的:库侧比完说 IDENTICAL,但**运行时**(后端 getPanelConfig 下发的顺序)仍差 2 处 ——
--   QC_RETURN 查询区 采购订单号/批次号 前后颠倒、PURCHASE_IN 明细多出一项。
--   两账套运行时对比脚本:tools/archive/_q-ledger-field-compare.mjs(登录工厂 YJ / YJ_TEST 分别取配置逐段比)。
--   ⇒ 结论:库侧元数据对齐 ≠ 界面字段顺序对齐,两边都要验。
--
-- 幂等与安全(本脚本可在两账套执行,正式库上为 no-op):
--   · UPDATE 一律带 place + 旧值守卫(seq=255 / hidden=0 / seq=36),正式库取值不同 ⇒ 0 行;
--   · DELETE 只删「同字段同 place 下 id 不是最小」的重复行,正式库该处只有一行 ⇒ 0 行;
--   · 不用 id 定位(两账套 id 是各自历史,同 id 可能是不同行 —— 第一轮里 id=7000 在两边是不同的字段行)。

SET NOCOUNT ON;
GO

-- ① PURCHASE_IN.批次号(查询区/表头)顺序对齐
UPDATE yj_field SET seq = 290
WHERE panel_code = N'PURCHASE_IN' AND col_name = N'批次号' AND place = N'query,header' AND seq = 255;
GO

-- ② PURCHASE_IN.本次结算金额本位币(明细)去掉重复行(只留 id 最小的那行)
DELETE FROM yj_field
WHERE panel_code = N'PURCHASE_IN' AND col_name = N'本次结算金额本位币' AND place = N'detail'
  AND id NOT IN (SELECT MIN(id) FROM yj_field
                 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'本次结算金额本位币' AND place = N'detail');
GO

-- ③ QC_RECV.数量(表头)可见性对齐:正式库 hidden=1、visible=0
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = N'QC_RECV' AND col_name = N'数量' AND place = N'header' AND hidden = 0;
GO

-- ④ QC_RETURN.批次号(查询区/表头)顺序对齐
UPDATE yj_field SET seq = 50
WHERE panel_code = N'QC_RETURN' AND col_name = N'批次号' AND place = N'query,header' AND seq = 36;
GO
