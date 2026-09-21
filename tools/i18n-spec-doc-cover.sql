-- i18n-spec-doc-cover.sql — 规格书封面重排配套多语言(2026-09-18)
--
-- 覆盖本轮封面重排涉及的显示文案:
--   · 「产品类别」—— 本轮新增字段(label 即译名键)。**实测 field scope 已有 9 语言**
--     (en=Category / ja=製品カテゴリ / … 见核对段),故此处只在缺失时兜底补,不重复插。
--     ⚠ zh-CN 是**源语言**,不建译名行;活跃目标语言 = 9 个(en/ja/ko/es/fr/de/ru/vi/th)。
--   · 「产品主要性能」—— 本轮进入封面,原先只有 en 一条,补齐其余 8 语言
--     (该字段 label 无换行/括注,按铁律 配置键=label,故 label 译名必须齐)。
--   · 封面 9 行的**标签样式**:设计原文写成「编 号」「版 本」(字间加空格),
--     但那是 Word 里的**两端对齐排版习惯**,不是字段名的一部分 —— 显示层由
--     recordSheetConfigs 的 label 决定,数据键永远是 yj_field.label(编号/版本),
--     故此脚本不建「编 号」「版 本」这两个伪译名键(建了反而会误导后人以为是字段)。
--
-- 幂等:NOT EXISTS 按 (scope, ref_key, locale) 去重。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- 产品主要性能(既有仅 en,补齐)
  ('field', N'产品主要性能', 'ja', N'主な性能'),
  ('field', N'产品主要性能', 'ko', N'주요 성능'),
  ('field', N'产品主要性能', 'es', N'Rendimiento principal'),
  ('field', N'产品主要性能', 'fr', N'Performance principale'),
  ('field', N'产品主要性能', 'de', N'Hauptleistung'),
  ('field', N'产品主要性能', 'ru', N'Основные характеристики'),
  ('field', N'产品主要性能', 'vi', N'Hiệu suất chính'),
  ('field', N'产品主要性能', 'th', N'สมรรถนะหลัก'),
  ('field', N'产品主要性能', 'zh-TW', N'產品主要性能'),

  -- 产品类别(兜底:已有则跳过,缺什么补什么)
  ('field', N'产品类别', 'en', N'Category'),
  ('field', N'产品类别', 'ja', N'製品カテゴリ'),
  ('field', N'产品类别', 'ko', N'제품 카테고리'),
  ('field', N'产品类别', 'es', N'Categoría de producto'),
  ('field', N'产品类别', 'fr', N'Catégorie de produit'),
  ('field', N'产品类别', 'de', N'Produktkategorie'),
  ('field', N'产品类别', 'ru', N'Категория продукции'),
  ('field', N'产品类别', 'vi', N'Danh mục sản phẩm'),
  ('field', N'产品类别', 'th', N'ประเภทสินค้า'),
  ('field', N'产品类别', 'zh-TW', N'產品類別'),

  -- ── 封面既有标签:原先**只有 en 一条**(实测),其余 8 语言缺 ⇒ 切到日语/韩语…封面会露中文。
  --    既然本轮重排封面,一并补齐(zh-CN 是源语言,不建行)。
  ('field', N'编号', 'ja', N'番号'), ('field', N'编号', 'ko', N'번호'),
  ('field', N'编号', 'es', N'N.º'), ('field', N'编号', 'fr', N'N°'),
  ('field', N'编号', 'de', N'Nr.'), ('field', N'编号', 'ru', N'№'),
  ('field', N'编号', 'vi', N'Số'), ('field', N'编号', 'th', N'เลขที่'),
  ('field', N'编号', 'zh-TW', N'編號'),

  ('field', N'客户料号', 'ja', N'顧客品番'), ('field', N'客户料号', 'ko', N'고객 품번'),
  ('field', N'客户料号', 'es', N'N.º de cliente'), ('field', N'客户料号', 'fr', N'Réf. client'),
  ('field', N'客户料号', 'de', N'Kunden-Teilenr.'), ('field', N'客户料号', 'ru', N'Артикул клиента'),
  ('field', N'客户料号', 'vi', N'Mã khách hàng'), ('field', N'客户料号', 'th', N'รหัสลูกค้า'),
  ('field', N'客户料号', 'zh-TW', N'客戶料號'),

  ('field', N'整体规格参数', 'ja', N'全体仕様'), ('field', N'整体规格参数', 'ko', N'전체 사양'),
  ('field', N'整体规格参数', 'es', N'Especificaciones generales'), ('field', N'整体规格参数', 'fr', N'Spécifications globales'),
  ('field', N'整体规格参数', 'de', N'Gesamtspezifikation'), ('field', N'整体规格参数', 'ru', N'Общие параметры'),
  ('field', N'整体规格参数', 'vi', N'Thông số tổng thể'), ('field', N'整体规格参数', 'th', N'ข้อมูลจำเพาะรวม'),
  ('field', N'整体规格参数', 'zh-TW', N'整體規格參數'),

  ('field', N'版本', 'ja', N'版数'), ('field', N'版本', 'ko', N'버전'),
  ('field', N'版本', 'es', N'Versión'), ('field', N'版本', 'fr', N'Version'),
  ('field', N'版本', 'de', N'Version'), ('field', N'版本', 'ru', N'Версия'),
  ('field', N'版本', 'vi', N'Phiên bản'), ('field', N'版本', 'th', N'เวอร์ชัน'),
  ('field', N'版本', 'zh-TW', N'版本'),

  -- 签字栏三组标签(封面底部;设计原文「制订/日期」等)
  ('field', N'制订/日期', 'ja', N'作成/日付'), ('field', N'制订/日期', 'ko', N'작성/일자'),
  ('field', N'制订/日期', 'es', N'Elaborado / Fecha'), ('field', N'制订/日期', 'fr', N'Établi / Date'),
  ('field', N'制订/日期', 'de', N'Erstellt / Datum'), ('field', N'制订/日期', 'ru', N'Составил / Дата'),
  ('field', N'制订/日期', 'vi', N'Lập / Ngày'), ('field', N'制订/日期', 'th', N'จัดทำ / วันที่'),
  ('field', N'制订/日期', 'zh-TW', N'制訂/日期'),

  ('field', N'审核/日期', 'ja', N'審査/日付'), ('field', N'审核/日期', 'ko', N'검토/일자'),
  ('field', N'审核/日期', 'es', N'Revisado / Fecha'), ('field', N'审核/日期', 'fr', N'Vérifié / Date'),
  ('field', N'审核/日期', 'de', N'Geprüft / Datum'), ('field', N'审核/日期', 'ru', N'Проверил / Дата'),
  ('field', N'审核/日期', 'vi', N'Kiểm tra / Ngày'), ('field', N'审核/日期', 'th', N'ตรวจสอบ / วันที่'),
  ('field', N'审核/日期', 'zh-TW', N'審核/日期'),

  ('field', N'批准/日期', 'ja', N'承認/日付'), ('field', N'批准/日期', 'ko', N'승인/일자'),
  ('field', N'批准/日期', 'es', N'Aprobado / Fecha'), ('field', N'批准/日期', 'fr', N'Approuvé / Date'),
  ('field', N'批准/日期', 'de', N'Genehmigt / Datum'), ('field', N'批准/日期', 'ru', N'Утвердил / Дата'),
  ('field', N'批准/日期', 'vi', N'Phê duyệt / Ngày'), ('field', N'批准/日期', 'th', N'อนุมัติ / วันที่'),
  ('field', N'批准/日期', 'zh-TW', N'批准/日期'),

  -- ── 第 4 页(成品及包装运输)本轮新增两节 ──
  ('field', N'炭棒处理要求', 'en', N'Rod Treatment Requirements'), ('field', N'炭棒处理要求', 'ja', N'炭棒の処理要件'),
  ('field', N'炭棒处理要求', 'ko', N'탄소봉 처리 요구사항'), ('field', N'炭棒处理要求', 'es', N'Requisitos de tratamiento de varilla'),
  ('field', N'炭棒处理要求', 'fr', N'Exigences de traitement du bâton'), ('field', N'炭棒处理要求', 'de', N'Anforderungen an die Stabbehandlung'),
  ('field', N'炭棒处理要求', 'ru', N'Требования к обработке стержня'), ('field', N'炭棒处理要求', 'vi', N'Yêu cầu xử lý thanh'),
  ('field', N'炭棒处理要求', 'th', N'ข้อกำหนดการจัดการแท่ง'), ('field', N'炭棒处理要求', 'zh-TW', N'炭棒處理要求'),

  ('field', N'出货检验报告', 'en', N'Shipping Inspection Report'), ('field', N'出货检验报告', 'ja', N'出荷検査報告書'),
  ('field', N'出货检验报告', 'ko', N'출하 검사 보고서'), ('field', N'出货检验报告', 'es', N'Informe de inspección de envío'),
  ('field', N'出货检验报告', 'fr', N'Rapport d''inspection avant expédition'), ('field', N'出货检验报告', 'de', N'Versandprüfbericht'),
  ('field', N'出货检验报告', 'ru', N'Отчёт о приёмочном контроле'), ('field', N'出货检验报告', 'vi', N'Báo cáo kiểm tra xuất hàng'),
  ('field', N'出货检验报告', 'th', N'รายงานการตรวจสอบการจัดส่ง'), ('field', N'出货检验报告', 'zh-TW', N'出貨檢驗報告')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- ═══ 核对:封面相关字段的译名覆盖(应为 9 语言 = 活跃目标语言数) ═══
PRINT N'--- 封面字段译名覆盖 ---';
SELECT v.k AS ref_key,
       (SELECT COUNT(*) FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = v.k) AS locales,
       CASE WHEN (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='field' AND t.ref_key=v.k) >= 9
            THEN N'OK' ELSE N'⚠ 缺' END AS verdict
FROM (VALUES (N'产品类别'),(N'产品主要性能'),(N'编号'),(N'客户名'),(N'客户料号'),
             (N'客户项目名称'),(N'应用场景'),(N'整体规格参数'),(N'版本'),
             (N'制订/日期'),(N'审核/日期'),(N'批准/日期'),
             (N'炭棒处理要求'),(N'出货检验报告')) AS v(k)
ORDER BY verdict DESC, v.k;
GO

PRINT N'i18n-spec-doc-cover.sql 完成';
GO
