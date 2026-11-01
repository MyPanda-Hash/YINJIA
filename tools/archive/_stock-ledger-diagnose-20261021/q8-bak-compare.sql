SET NOCOUNT ON;
-- 2026-10-21 取证时:_bak_pc0000_20261018_{inh,kucun,outh} 还在(538 / 540 / 2334 行),
-- 当天 13:48 的 4ba6f63b 把 12 张 _bak_* 快照表整体删掉 ⇒ 现在应该"不存在"。
-- 本脚本只报告在不在,不再查内容(内容已不可恢复;删前数字见
-- tools/archive/_srv1021-vs-local-20261021/raw-02-data-diff-full.txt 开头几行)。
SELECT 表名 = v.name,
       存在 = CASE WHEN OBJECT_ID('dbo.' + v.name) IS NULL THEN '否(已被 4ba6f63b 删除)' ELSE '是' END
FROM (VALUES ('_bak_pc0000_20261018_inh'), ('_bak_pc0000_20261018_outh'),
             ('_bak_pc0000_20261018_kucun'), ('_bak_pc0000_baseline'),
             ('_bak_qcdraft_fst_head_20261021')) v(name);

-- 现在库里还剩哪些 _bak_ 快照表
SELECT 剩余快照表 = name FROM sys.tables WHERE name LIKE '_bak[_]%' ORDER BY name;
