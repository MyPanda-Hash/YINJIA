-- i18n-asm-proc-redesign.sql — 组装工艺清单 3 页签重排的配套多语言
--
-- 【为什么必须一起交付】AGENTS.md 硬性规定:新增面板/字段必须同时交付多语言,否则视为功能未完成。
--   label 是译名键(scope='field'),页签名/表区条走 tt()(scope='field' + scope='ui' 合并成 biz 词典)。
--
-- 本脚本只补**真正缺的**键(先查过活库,避免重复写):
--   ① 关键控制清单   —— 全新键(表区条 + [表区] 字典值),10 语言全缺
--   ② 产品整体尺寸/密级/使用范围/修订记录 —— 活库只有 en 一条(来自规格书/成型工艺那两轮),
--      本轮作为组装工艺面板的字段名与页签名使用,补齐另外 9 语言
--   已满 10 语言、本轮**不动**的键:表单管理人 / 版本号 / 物料名称 / 组装BOM表 / 组装工艺清单 /
--   产品基本信息 / 客户项目名称 / 产品功能类别 等。
--
-- 幂等:NOT EXISTS 按 (scope, ref_key, locale) 去重,可重复执行。
-- 语言:与 yj_locale 启用清单一致(en/ja/ko/es/fr/de/ru/vi/th/zh-TW 共 10 种;zh-CN 是源语言不建行)。
-- 用法:sqlcmd -f 65001 -i tools/i18n-asm-proc-redesign.sql 或 SqlRunner
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- ── 表区条 / [表区] 字典值:关键控制清单 ──
  ('field', N'关键控制清单', 'en',    N'Critical Control Checklist'),
  ('field', N'关键控制清单', 'ja',    N'重要管理項目チェックリスト'),
  ('field', N'关键控制清单', 'ko',    N'중요 관리 항목 체크리스트'),
  ('field', N'关键控制清单', 'es',    N'Lista de control crítico'),
  ('field', N'关键控制清单', 'fr',    N'Liste de contrôle critique'),
  ('field', N'关键控制清单', 'de',    N'Kritische Kontrollliste'),
  ('field', N'关键控制清单', 'ru',    N'Перечень критического контроля'),
  ('field', N'关键控制清单', 'vi',    N'Danh mục kiểm soát trọng yếu'),
  ('field', N'关键控制清单', 'th',    N'รายการควบคุมที่สำคัญ'),
  ('field', N'关键控制清单', 'zh-TW', N'關鍵控制清單'),

  -- ── 页签 0 名 / 页标题:修订记录(en=Revisions 已存在) ──
  ('field', N'修订记录', 'ja',    N'改訂履歴'),
  ('field', N'修订记录', 'ko',    N'개정 이력'),
  ('field', N'修订记录', 'es',    N'Registro de revisiones'),
  ('field', N'修订记录', 'fr',    N'Historique des révisions'),
  ('field', N'修订记录', 'de',    N'Änderungshistorie'),
  ('field', N'修订记录', 'ru',    N'История изменений'),
  ('field', N'修订记录', 'vi',    N'Lịch sử sửa đổi'),
  ('field', N'修订记录', 'th',    N'ประวัติการแก้ไข'),
  ('field', N'修订记录', 'zh-TW', N'修訂記錄'),

  -- ── 产品基本信息第 4 格:产品整体尺寸(en=Overall Size 已存在) ──
  ('field', N'产品整体尺寸', 'ja',    N'製品全体寸法'),
  ('field', N'产品整体尺寸', 'ko',    N'제품 전체 치수'),
  ('field', N'产品整体尺寸', 'es',    N'Dimensiones generales del producto'),
  ('field', N'产品整体尺寸', 'fr',    N'Dimensions globales du produit'),
  ('field', N'产品整体尺寸', 'de',    N'Gesamtmaße des Produkts'),
  ('field', N'产品整体尺寸', 'ru',    N'Габаритные размеры изделия'),
  ('field', N'产品整体尺寸', 'vi',    N'Kích thước tổng thể sản phẩm'),
  ('field', N'产品整体尺寸', 'th',    N'ขนาดโดยรวมของผลิตภัณฑ์'),
  ('field', N'产品整体尺寸', 'zh-TW', N'產品整體尺寸'),

  -- ── 报告头信息栏:密级(en=Confidentiality 已存在) ──
  ('field', N'密级', 'ja',    N'機密区分'),
  ('field', N'密级', 'ko',    N'기밀 등급'),
  ('field', N'密级', 'es',    N'Nivel de confidencialidad'),
  ('field', N'密级', 'fr',    N'Niveau de confidentialité'),
  ('field', N'密级', 'de',    N'Vertraulichkeitsstufe'),
  ('field', N'密级', 'ru',    N'Уровень конфиденциальности'),
  ('field', N'密级', 'vi',    N'Cấp độ bảo mật'),
  ('field', N'密级', 'th',    N'ระดับความลับ'),
  ('field', N'密级', 'zh-TW', N'密級'),

  -- ── 报告头信息栏:使用范围(en=Usage Scope 已存在) ──
  ('field', N'使用范围', 'ja',    N'使用範囲'),
  ('field', N'使用范围', 'ko',    N'사용 범위'),
  ('field', N'使用范围', 'es',    N'Ámbito de uso'),
  ('field', N'使用范围', 'fr',    N'Domaine d''utilisation'),
  ('field', N'使用范围', 'de',    N'Verwendungsbereich'),
  ('field', N'使用范围', 'ru',    N'Область применения'),
  ('field', N'使用范围', 'vi',    N'Phạm vi sử dụng'),
  ('field', N'使用范围', 'th',    N'ขอบเขตการใช้งาน'),
  ('field', N'使用范围', 'zh-TW', N'使用範圍')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                   WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- 校验:每个键应恰好 10 个语言
SELECT ref_key, COUNT(*) AS 语言数
FROM yj_translation
WHERE scope = N'field' AND ref_key IN (N'关键控制清单', N'修订记录', N'产品整体尺寸', N'密级', N'使用范围')
GROUP BY ref_key
ORDER BY ref_key;
GO

PRINT N'i18n-asm-proc-redesign.sql 完成';
GO
