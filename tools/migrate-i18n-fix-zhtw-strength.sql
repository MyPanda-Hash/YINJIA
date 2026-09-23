-- migrate-i18n-fix-zhtw-strength.sql — 修机翻坏译名:强度要求kgf / zh-TW 混入的 2 个 U+FFFD
--
-- 现象:切繁体中文时该标签显示为「強度要求 ??kgf」(两个替换字符 U+FFFD)。
--
-- 根因(已实证,勿重复调查):
--   ① 坏值由 158ea03「其他10个语言包按 en.js 基准补齐机翻」写入 —— 该提交的 git blob 原文
--      就含 U+FFFD(即机翻返回值本身带坏字符),不是后来被误读写坏的,git 里没有干净版本;
--   ② 此后一直没被发现,是因为 **Windows 排序规则下 U+FFFD 按 best-fit 匹配**:实测
--      · `text LIKE N'%'+NCHAR(65533)+N'%'`  命中全表 18080 行(等于没筛);
--      · `REPLACE(text, NCHAR(65533), N'')` **静默空操作**(实测长度不变),即"跑了但没修好"。
--      两种写法都必须显式加 `COLLATE Latin1_General_BIN2` 才按码位精确比较。
--      检测坏译名的正确写法:CHARINDEX(NCHAR(65533) COLLATE Latin1_General_BIN2, text COLLATE Latin1_General_BIN2) > 0
--      实测全表真实坏行 = 1(仅本行)。
--
-- 修法:只删坏字符,其余一个字符不动 —— 同批 de/ru/th/vi/ko/es 该键都是「文字 + 空格 + kgf」,
--       那个空格是未被损坏的 ASCII,必须保留;坏字符丢掉的原字无从得知,不做臆测改写。
--       source 由 mt 升级 manual(机翻词条经人工核对后的既有约定,见 AGENTS.md 多语言规范)。
--
-- 幂等:无坏字符时 UPDATE 命中 0 行;可重复执行。
SET NOCOUNT ON;
GO

UPDATE yj_translation
   SET text   = REPLACE(text COLLATE Latin1_General_BIN2, NCHAR(65533) COLLATE Latin1_General_BIN2, N''),
       source = 'manual'
 WHERE scope = 'ui' AND ref_key = N'强度要求kgf' AND locale = 'zh-TW'
   AND CHARINDEX(NCHAR(65533) COLLATE Latin1_General_BIN2, text COLLATE Latin1_General_BIN2) > 0;
GO

-- 自检:①全表不得再有 U+FFFD;②该行现值
SELECT N'残留坏译名' AS k, COUNT(*) AS n
  FROM yj_translation
 WHERE CHARINDEX(NCHAR(65533) COLLATE Latin1_General_BIN2, text COLLATE Latin1_General_BIN2) > 0;

SELECT N'该行现值' AS k, scope, ref_key, locale, source, text
  FROM yj_translation
 WHERE scope = 'ui' AND ref_key = N'强度要求kgf' AND locale = 'zh-TW';
GO
