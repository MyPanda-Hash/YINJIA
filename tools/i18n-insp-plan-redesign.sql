-- i18n-insp-plan-redesign.sql — 出货检验项目控制计划重设计的配套多语言
--
-- 设计源:《产品开发\2.产品文件\3.检验计划表\出货检验项目控制计划.xlsx》
-- 姊妹脚本:migrate-insp-plan-redesign-2026-09-20.sql(加列 + 建字段 + alias)
--
-- 【为什么必须一起交付】AGENTS.md 硬性规定:新增面板/字段必须同时交付多语言。
--   本面板的报告头大标题(titlePlaceholder)与表尾注(footerNote)都走前端 tt(),
--   且表尾注**有先例**——成型工艺面板那条「请各位实验人员知悉…」长句在库里有 10 语言
--   (见 tools/archive/_probe-insp-i18n.out.txt),所以长句也照建,不搞特殊。
--
-- 【去重键为什么**不带 scope**】tt() 查的是 field + ui **合并后**的 biz 词典。
--   实测(探针):「检验方法」ui 侧已有 de/es/fr/ja/ko/ru/th/vi/zh-TW 九条,只 en 在 field;
--   「检测频率」同款。若按 (scope, ref_key, locale) 去重再补 field 行,合并词典里就会出现
--   同键同语言两条,谁生效取决于合并顺序 —— 那是个隐患,不是修复。
--   ⇒ 本脚本去重键取 (ref_key, locale),**任一 scope 已有就跳过**,天然不会撞车。
--     副作用是幂等更强:重复执行零写入。
--
-- 【为什么不动 检验方法 / 检测频率】上条已说明:合并词典里它们已是满 10 语言,
--   本轮只是把「控制方法」「检测频率」两个 label 用 alias 显示成这两个名字,
--   译名直接复用,无需新建。(alias 是显示层改名,数据键仍是 控制方法 / 检测频率。)
--
-- 语言:en/ja/ko/es/fr/de/ru/vi/th/zh-TW 共 10 种;zh-CN 是源语言不建行。
-- 用法:sqlcmd -f 65001 -i tools/i18n-insp-plan-redesign.sql 或 SqlRunner
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- ── 报告头大标题(titlePlaceholder) ──
  ('field', N'出货检验项目控制计划', 'en',    N'Shipment Inspection Item Control Plan'),
  ('field', N'出货检验项目控制计划', 'ja',    N'出荷検査項目管理計画'),
  ('field', N'出货检验项目控制计划', 'ko',    N'출하 검사 항목 관리 계획'),
  ('field', N'出货检验项目控制计划', 'es',    N'Plan de control de ítems de inspección de envío'),
  ('field', N'出货检验项目控制计划', 'fr',    N'Plan de contrôle des éléments d''inspection à l''expédition'),
  ('field', N'出货检验项目控制计划', 'de',    N'Kontrollplan für Versandprüfpositionen'),
  ('field', N'出货检验项目控制计划', 'ru',    N'План контроля пунктов отгрузочной инспекции'),
  ('field', N'出货检验项目控制计划', 'vi',    N'Kế hoạch kiểm soát hạng mục kiểm tra xuất hàng'),
  ('field', N'出货检验项目控制计划', 'th',    N'แผนควบคุมรายการตรวจสอบการจัดส่ง'),
  ('field', N'出货检验项目控制计划', 'zh-TW', N'出貨檢驗項目控制計畫'),

  -- ── 表尾注(footerNote,长句也建译名 —— 有先例) ──
  ('field', N'若规格书有变动提示管控文件需更新', 'en',    N'If the specification changes, note that the controlled document must be updated'),
  ('field', N'若规格书有变动提示管控文件需更新', 'ja',    N'仕様書に変更がある場合は、管理文書の更新が必要である旨をご留意ください'),
  ('field', N'若规格书有变动提示管控文件需更新', 'ko',    N'사양서가 변경되면 관리 문서를 갱신해야 함을 알려 주십시오'),
  ('field', N'若规格书有变动提示管控文件需更新', 'es',    N'Si la especificación cambia, tenga en cuenta que el documento controlado debe actualizarse'),
  ('field', N'若规格书有变动提示管控文件需更新', 'fr',    N'En cas de modification de la fiche technique, le document contrôlé doit être mis à jour'),
  ('field', N'若规格书有变动提示管控文件需更新', 'de',    N'Bei Änderungen der Spezifikation ist das gelenkte Dokument zu aktualisieren'),
  ('field', N'若规格书有变动提示管控文件需更新', 'ru',    N'При изменении спецификации необходимо обновить контролируемый документ'),
  ('field', N'若规格书有变动提示管控文件需更新', 'vi',    N'Nếu bản đặc tính có thay đổi, xin lưu ý cập nhật tài liệu được kiểm soát'),
  ('field', N'若规格书有变动提示管控文件需更新', 'th',    N'หากข้อกำหนดมีการเปลี่ยนแปลง โปรดอัปเดตเอกสารควบคุม'),
  ('field', N'若规格书有变动提示管控文件需更新', 'zh-TW', N'若規格書有變動提示管控文件需更新'),

  -- ── 明细列名(alias 后的显示名):检查频率 = 检测频率 的 alias ──
  ('field', N'检查频率', 'en',    N'Check Frequency'),
  ('field', N'检查频率', 'ja',    N'検査頻度'),
  ('field', N'检查频率', 'ko',    N'검사 빈도'),
  ('field', N'检查频率', 'es',    N'Frecuencia de comprobación'),
  ('field', N'检查频率', 'fr',    N'Fréquence de vérification'),
  ('field', N'检查频率', 'de',    N'Prüfhäufigkeit'),
  ('field', N'检查频率', 'ru',    N'Частота проверки'),
  ('field', N'检查频率', 'vi',    N'Tần suất kiểm tra'),
  ('field', N'检查频率', 'th',    N'ความถี่ในการตรวจสอบ'),
  ('field', N'检查频率', 'zh-TW', N'檢查頻率'),

  -- ── 明细列名:检验项目 = 控制项目 的 alias(活库只有 en) ──
  ('field', N'检验项目', 'ja',    N'検査項目'),
  ('field', N'检验项目', 'ko',    N'검사 항목'),
  ('field', N'检验项目', 'es',    N'Ítem de inspección'),
  ('field', N'检验项目', 'fr',    N'Élément d''inspection'),
  ('field', N'检验项目', 'de',    N'Prüfposition'),
  ('field', N'检验项目', 'ru',    N'Пункт проверки'),
  ('field', N'检验项目', 'vi',    N'Hạng mục kiểm tra'),
  ('field', N'检验项目', 'th',    N'รายการตรวจสอบ'),
  ('field', N'检验项目', 'zh-TW', N'檢驗項目'),

  -- ── 明细列名:检验要求 = 控制标准及要求 的 alias ──
  ('field', N'检验要求', 'en',    N'Inspection Requirement'),
  ('field', N'检验要求', 'ja',    N'検査要求'),
  ('field', N'检验要求', 'ko',    N'검사 요구사항'),
  ('field', N'检验要求', 'es',    N'Requisito de inspección'),
  ('field', N'检验要求', 'fr',    N'Exigence d''inspection'),
  ('field', N'检验要求', 'de',    N'Prüfanforderung'),
  ('field', N'检验要求', 'ru',    N'Требование проверки'),
  ('field', N'检验要求', 'vi',    N'Yêu cầu kiểm tra'),
  ('field', N'检验要求', 'th',    N'ข้อกำหนดการตรวจสอบ'),
  ('field', N'检验要求', 'zh-TW', N'檢驗要求'),

  -- ── 明细列名:不合格应对措施(活库只有 en) ──
  ('field', N'不合格应对措施', 'ja',    N'不適合時の対応措置'),
  ('field', N'不合格应对措施', 'ko',    N'부적합 대응 조치'),
  ('field', N'不合格应对措施', 'es',    N'Medidas ante no conformidad'),
  ('field', N'不合格应对措施', 'fr',    N'Mesures en cas de non-conformité'),
  ('field', N'不合格应对措施', 'de',    N'Maßnahmen bei Nichtkonformität'),
  ('field', N'不合格应对措施', 'ru',    N'Меры при несоответствии'),
  ('field', N'不合格应对措施', 'vi',    N'Biện pháp xử lý không phù hợp'),
  ('field', N'不合格应对措施', 'th',    N'มาตรการรับมือสิ่งที่ไม่เป็นไปตามข้อกำหนด'),
  ('field', N'不合格应对措施', 'zh-TW', N'不合格應對措施'),

  -- ── 表头字段:编写人(活库只有 en) ──
  ('field', N'编写人', 'ja',    N'作成者'),
  ('field', N'编写人', 'ko',    N'작성자'),
  ('field', N'编写人', 'es',    N'Redactor'),
  ('field', N'编写人', 'fr',    N'Rédacteur'),
  ('field', N'编写人', 'de',    N'Ersteller'),
  ('field', N'编写人', 'ru',    N'Составитель'),
  ('field', N'编写人', 'vi',    N'Người soạn thảo'),
  ('field', N'编写人', 'th',    N'ผู้จัดทำ'),
  ('field', N'编写人', 'zh-TW', N'編寫人'),

  -- ── 表头字段:产品编号(活库只有 en/ja) ──
  ('field', N'产品编号', 'ko',    N'제품 번호'),
  ('field', N'产品编号', 'es',    N'N.º de producto'),
  ('field', N'产品编号', 'fr',    N'N° de produit'),
  ('field', N'产品编号', 'de',    N'Produktnummer'),
  ('field', N'产品编号', 'ru',    N'Номер изделия'),
  ('field', N'产品编号', 'vi',    N'Mã sản phẩm'),
  ('field', N'产品编号', 'th',    N'หมายเลขผลิตภัณฑ์'),
  ('field', N'产品编号', 'zh-TW', N'產品編號')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                   WHERE t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- 校验:本轮每个键在合并词典(field+ui)里应恰好 10 语言,且同键同语言只有一条
SELECT ref_key,
       COUNT(*) AS 合并行数,
       COUNT(DISTINCT locale) AS 语言数,
       SUM(CASE WHEN scope = 'field' THEN 1 ELSE 0 END) AS field侧,
       SUM(CASE WHEN scope = 'ui'    THEN 1 ELSE 0 END) AS ui侧
FROM yj_translation
WHERE ref_key IN (N'出货检验项目控制计划', N'若规格书有变动提示管控文件需更新', N'检查频率',
                  N'检验项目', N'检验要求', N'不合格应对措施', N'编写人', N'产品编号',
                  N'检验方法', N'检测频率')
GROUP BY ref_key
ORDER BY ref_key;
GO

PRINT N'i18n-insp-plan-redesign.sql 完成';
GO
