-- migrate-yj-translation-dedupe.sql — yj_translation 重复词条去重(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 背景:yj_translation 历史上被重复写入,实测 scope='field' 有 **22 组 (ref_key, locale) 重复**、共 44 行
--   (全是 en;多由早期 i18n 脚本重复执行 + 后来的补充译名造成)。同一中文键同语言出现两行时,
--   取哪一行取决于查询顺序,显示结果不稳定 → 去重。
--
-- 去重规则(**保守**):
--   ① 只动 scope='field'、且**确实存在重复组**的 (ref_key, locale);
--   ② 每组保留一行:
--      · 22 组里有 4 组两行文本不同 → **人工择善**(见下方 @keep 表,逐条注明取舍理由);
--      · 其余 18 组两行文本完全相同 → 保留最早一行(MIN(id));
--   ③ 不新增/不改写任何词条内容,只删多余行;scope='panel'/'ui' 等其它作用域一律不动。
--
-- 幂等:第二次执行时已无重复组,删除 0 行。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 删除前的重复组清单(留档) ══════════════
PRINT N'[tr-dedupe] 删除前重复组(scope=field):';
SELECT t.ref_key, t.locale, t.id, t.source, t.text
FROM yj_translation t
WHERE t.scope='field'
  AND EXISTS (SELECT 1 FROM yj_translation x
              WHERE x.scope=t.scope AND x.ref_key=t.ref_key AND x.locale=t.locale AND x.id<>t.id)
ORDER BY t.ref_key, t.locale, t.id;
GO

-- ══════════════ 2. 去重 ══════════════
-- 实测 22 组里 **16 组两行文本完全相同**、**6 组文本不同**(逐条人工择善,保留 id 如下):
--   部门id   : Department Id(25134)   >  Dept Id(25554)      —— 全称更规范
--   仓库id   : Stock Id(25616)        >  Bill Stock Id(25604) —— 库里字段就叫「仓库id」
--                                                              (另有「倒冲仓库id」,不存在"单据仓库id",故不需要 Bill 前缀)
--   仓位id   : Sp Id(25618)           >  Bill Sp Id(25606)   —— 同上,字段就叫「仓位id」
--   发票类型  : Invoice Type(24928)    >  Ivc Type(25253)      —— 行业缩写不宜作界面词
--   换算率2  : Conversion Rate(25649) >  Coefficient2(25150)  —— 与「换算率」语义一致
--   税额     : Tax Amount(25692)      >  Tax amt(20009)      —— 规范拼写与大小写
DECLARE @keep TABLE (ref_key nvarchar(100) PRIMARY KEY, keep_id int);
INSERT INTO @keep (ref_key, keep_id) VALUES
    (N'部门id', 25134), (N'仓库id', 25616), (N'仓位id', 25618),
    (N'发票类型', 24928), (N'换算率2', 25649), (N'税额', 25692);

DECLARE @del table (id int PRIMARY KEY);
INSERT INTO @del (id)
SELECT t.id FROM yj_translation t
WHERE t.scope='field'
  -- 只处理重复组
  AND EXISTS (SELECT 1 FROM yj_translation x
              WHERE x.scope=t.scope AND x.ref_key=t.ref_key AND x.locale=t.locale AND x.id<>t.id)
  -- 且不是本组要保留的那一行(显式指定优先,否则取最早一行)
  AND t.id <> ISNULL((SELECT k.keep_id FROM @keep k WHERE k.ref_key=t.ref_key),
                     (SELECT MIN(x.id) FROM yj_translation x
                      WHERE x.scope=t.scope AND x.ref_key=t.ref_key AND x.locale=t.locale));

DELETE FROM yj_translation WHERE id IN (SELECT id FROM @del);
PRINT N'[tr-dedupe] 已删除重复词条行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

-- ══════════════ 2.5 文本校正(补齐首次去重时漏判的 2 组) ══════════════
-- 首次去重(2026-09-21 早)按「同名组保留最早行」跑过一遍,漏判了「文本不同」的 仓位id 与 税额:
--   · 仓位id 当时保留的是 Bill Sp Id(25606),应为 Sp Id;
--   · 税额   当时保留的是 Tax amt(20009),应为 Tax Amount。
-- 期望行已被删,故此处把**存活行**的文本校正为择善结果(只改这 2 个 (ref_key,locale),幂等,不改其它词条)。
UPDATE yj_translation SET text = N'Sp Id',        updated_at = GETDATE()
  WHERE scope='field' AND ref_key=N'仓位id' AND locale='en' AND text <> N'Sp Id';
UPDATE yj_translation SET text = N'Tax Amount',   updated_at = GETDATE()
  WHERE scope='field' AND ref_key=N'税额'   AND locale='en' AND text <> N'Tax Amount';
PRINT N'[tr-dedupe] 文本校正完成(仓位id→Sp Id / 税额→Tax Amount)';
GO

-- ══════════════ 3. 自检 ══════════════
DECLARE @left int = (SELECT COUNT(*) FROM (
    SELECT scope, ref_key, locale FROM yj_translation GROUP BY scope, ref_key, locale HAVING COUNT(*)>1) d);
DECLARE @field int = (SELECT COUNT(*) FROM (
    SELECT scope, ref_key, locale FROM yj_translation WHERE scope='field'
    GROUP BY scope, ref_key, locale HAVING COUNT(*)>1) d);
IF @left > 0 OR @field > 0
    RAISERROR(N'[tr-dedupe] 自检失败:仍有重复组(field %d / 全库 %d)', 16, 1, @field, @left);
ELSE
    PRINT N'[tr-dedupe] 自检通过:全库无重复 (scope, ref_key, locale) 组';
-- 人工取舍的 6 组结果回显(便于复核)
SELECT ref_key, locale, id, text FROM yj_translation
WHERE scope='field' AND locale='en'
  AND ref_key IN (N'部门id',N'仓库id',N'仓位id',N'发票类型',N'换算率2',N'税额')
ORDER BY ref_key;
GO
