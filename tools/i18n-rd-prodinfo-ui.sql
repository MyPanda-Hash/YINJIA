-- i18n-rd-prodinfo-ui.sql — 产品信息表界面调整配套多语言(2026-09-18 第二轮)
--
-- 覆盖本轮新增/改动的显示文案:
--   · 「编号：」—— 23 个文书面板纸张右上角逐格的前置标识(RecordSheetPanels 报告头)
--   · 炭棒尺寸拆三格的**字段 label**(炭棒内径/炭棒外径/炭棒长度)与**提示词**(内径(mm)/外径(mm)/长度(mm))
--     ⚠ 两者是**两套键**:译名以 label 为键 ⇒ 字段 label 必须有译名,
--       否则英文界面字段名显中文(提示词是 ph,走 tt('内径(mm)') 另算)。
--       第一版只加了提示词那套,字段 label 那套漏了 —— 实测 en 下三个字段仍显中文。
--   · 审核人两级标签:审核人（一级审批人）/ 审核人（二级审批人）
--   · 产品功能类别 字典值(除余氯/VOC/重金属)—— 字典值属**数据**,
--     ADR-0001「字典翻」口径:下拉候选来自 dict_sql,显示层按 yj_translation(scope='field') 命中
--
-- 幂等:NOT EXISTS 按 (scope, ref_key, locale) 去重。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- 「编号：」纸张右上角标识
  ('field', N'编号：', 'en', N'No.: '), ('field', N'编号：', 'ja', N'番号：'),
  ('field', N'编号：', 'ko', N'번호: '), ('field', N'编号：', 'es', N'N.º: '),
  ('field', N'编号：', 'fr', N'N° : '), ('field', N'编号：', 'de', N'Nr.: '),
  ('field', N'编号：', 'ru', N'№: '), ('field', N'编号：', 'vi', N'Số: '),
  ('field', N'编号：', 'th', N'เลขที่: '), ('field', N'编号：', 'zh-TW', N'編號：'),

  -- 炭棒尺寸三格的**字段 label**(译名以 label 为键 —— 见文件头说明)
  ('field', N'炭棒内径', 'en', N'Rod Inner Dia.'), ('field', N'炭棒内径', 'ja', N'炭棒内径'),
  ('field', N'炭棒内径', 'ko', N'탄소봉 내경'), ('field', N'炭棒内径', 'es', N'Diám. interior de varilla'),
  ('field', N'炭棒内径', 'fr', N'Diam. int. du bâton'), ('field', N'炭棒内径', 'de', N'Stab-Innendurchmesser'),
  ('field', N'炭棒内径', 'ru', N'Внутр. диам. стержня'), ('field', N'炭棒内径', 'vi', N'ĐK trong thanh'),
  ('field', N'炭棒内径', 'th', N'เส้นผ่าศูนย์กลางในแท่ง'), ('field', N'炭棒内径', 'zh-TW', N'炭棒內徑'),

  ('field', N'炭棒外径', 'en', N'Rod Outer Dia.'), ('field', N'炭棒外径', 'ja', N'炭棒外径'),
  ('field', N'炭棒外径', 'ko', N'탄소봉 외경'), ('field', N'炭棒外径', 'es', N'Diám. exterior de varilla'),
  ('field', N'炭棒外径', 'fr', N'Diam. ext. du bâton'), ('field', N'炭棒外径', 'de', N'Stab-Außendurchmesser'),
  ('field', N'炭棒外径', 'ru', N'Наруж. диам. стержня'), ('field', N'炭棒外径', 'vi', N'ĐK ngoài thanh'),
  ('field', N'炭棒外径', 'th', N'เส้นผ่าศูนย์กลางนอกแท่ง'), ('field', N'炭棒外径', 'zh-TW', N'炭棒外徑'),

  ('field', N'炭棒长度', 'en', N'Rod Length'), ('field', N'炭棒长度', 'ja', N'炭棒長さ'),
  ('field', N'炭棒长度', 'ko', N'탄소봉 길이'), ('field', N'炭棒长度', 'es', N'Longitud de varilla'),
  ('field', N'炭棒长度', 'fr', N'Longueur du bâton'), ('field', N'炭棒长度', 'de', N'Stablänge'),
  ('field', N'炭棒长度', 'ru', N'Длина стержня'), ('field', N'炭棒长度', 'vi', N'Chiều dài thanh'),
  ('field', N'炭棒长度', 'th', N'ความยาวแท่ง'), ('field', N'炭棒长度', 'zh-TW', N'炭棒長度'),

  -- 炭棒尺寸三格的**提示词**(ph,前端 tt() 用)
  ('field', N'内径(mm)', 'en', N'Inner dia. (mm)'), ('field', N'内径(mm)', 'ja', N'内径(mm)'),
  ('field', N'内径(mm)', 'ko', N'내경(mm)'), ('field', N'内径(mm)', 'es', N'Diám. interior (mm)'),
  ('field', N'内径(mm)', 'fr', N'Diam. intérieur (mm)'), ('field', N'内径(mm)', 'de', N'Innendurchmesser (mm)'),
  ('field', N'内径(mm)', 'ru', N'Внутр. диаметр (мм)'), ('field', N'内径(mm)', 'vi', N'Đường kính trong (mm)'),
  ('field', N'内径(mm)', 'th', N'เส้นผ่านศูนย์กลางใน (มม.)'), ('field', N'内径(mm)', 'zh-TW', N'內徑(mm)'),

  ('field', N'外径(mm)', 'en', N'Outer dia. (mm)'), ('field', N'外径(mm)', 'ja', N'外径(mm)'),
  ('field', N'外径(mm)', 'ko', N'외경(mm)'), ('field', N'外径(mm)', 'es', N'Diám. exterior (mm)'),
  ('field', N'外径(mm)', 'fr', N'Diam. extérieur (mm)'), ('field', N'外径(mm)', 'de', N'Außendurchmesser (mm)'),
  ('field', N'外径(mm)', 'ru', N'Наруж. диаметр (мм)'), ('field', N'外径(mm)', 'vi', N'Đường kính ngoài (mm)'),
  ('field', N'外径(mm)', 'th', N'เส้นผ่านศูนย์กลางนอก (มม.)'), ('field', N'外径(mm)', 'zh-TW', N'外徑(mm)'),

  ('field', N'长度(mm)', 'en', N'Length (mm)'), ('field', N'长度(mm)', 'ja', N'長さ(mm)'),
  ('field', N'长度(mm)', 'ko', N'길이(mm)'), ('field', N'长度(mm)', 'es', N'Longitud (mm)'),
  ('field', N'长度(mm)', 'fr', N'Longueur (mm)'), ('field', N'长度(mm)', 'de', N'Länge (mm)'),
  ('field', N'长度(mm)', 'ru', N'Длина (мм)'), ('field', N'长度(mm)', 'vi', N'Chiều dài (mm)'),
  ('field', N'长度(mm)', 'th', N'ความยาว (มม.)'), ('field', N'长度(mm)', 'zh-TW', N'長度(mm)'),

  -- 两级审核人(标签随本轮文案调整)
  ('field', N'审核人（一级审批人）', 'en', N'Reviewer (L1 approval)'), ('field', N'审核人（一级审批人）', 'ja', N'承認者(一次承認)'),
  ('field', N'审核人（一级审批人）', 'ko', N'승인자(1차 승인)'), ('field', N'审核人（一级审批人）', 'es', N'Revisor (aprob. nivel 1)'),
  ('field', N'审核人（一级审批人）', 'fr', N'Approbateur (N1)'), ('field', N'审核人（一级审批人）', 'de', N'Prüfer (Freigabe 1)'),
  ('field', N'审核人（一级审批人）', 'ru', N'Утверждающий (1 ур.)'), ('field', N'审核人（一级审批人）', 'vi', N'Người duyệt (cấp 1)'),
  ('field', N'审核人（一级审批人）', 'th', N'ผู้อนุมัติ (ระดับ 1)'), ('field', N'审核人（一级审批人）', 'zh-TW', N'審核人（一級審批人）'),

  ('field', N'审核人（二级审批人）', 'en', N'Reviewer (L2 approval)'), ('field', N'审核人（二级审批人）', 'ja', N'承認者(二次承認)'),
  ('field', N'审核人（二级审批人）', 'ko', N'승인자(2차 승인)'), ('field', N'审核人（二级审批人）', 'es', N'Revisor (aprob. nivel 2)'),
  ('field', N'审核人（二级审批人）', 'fr', N'Approbateur (N2)'), ('field', N'审核人（二级审批人）', 'de', N'Prüfer (Freigabe 2)'),
  ('field', N'审核人（二级审批人）', 'ru', N'Утверждающий (2 ур.)'), ('field', N'审核人（二级审批人）', 'vi', N'Người duyệt (cấp 2)'),
  ('field', N'审核人（二级审批人）', 'th', N'ผู้อนุมัติ (ระดับ 2)'), ('field', N'审核人（二级审批人）', 'zh-TW', N'審核人（二級審批人）'),

  -- 产品功能类别 字典值(显示层译名)
  ('field', N'除余氯', 'en', N'Chlorine Removal'), ('field', N'除余氯', 'ja', N'残留塩素除去'),
  ('field', N'除余氯', 'ko', N'잔류염소 제거'), ('field', N'除余氯', 'es', N'Eliminación de cloro'),
  ('field', N'除余氯', 'fr', N'Élimination du chlore'), ('field', N'除余氯', 'de', N'Chlorentfernung'),
  ('field', N'除余氯', 'ru', N'Удаление хлора'), ('field', N'除余氯', 'vi', N'Loại bỏ clo'),
  ('field', N'除余氯', 'th', N'กำจัดคลอรีน'), ('field', N'除余氯', 'zh-TW', N'除餘氯'),

  ('field', N'重金属', 'en', N'Heavy Metals'), ('field', N'重金属', 'ja', N'重金属'),
  ('field', N'重金属', 'ko', N'중금속'), ('field', N'重金属', 'es', N'Metales pesados'),
  ('field', N'重金属', 'fr', N'Métaux lourds'), ('field', N'重金属', 'de', N'Schwermetalle'),
  ('field', N'重金属', 'ru', N'Тяжёлые металлы'), ('field', N'重金属', 'vi', N'Kim loại nặng'),
  ('field', N'重金属', 'th', N'โลหะหนัก'), ('field', N'重金属', 'zh-TW', N'重金屬')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

SELECT v.k AS ref_key, (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='field' AND t.ref_key=v.k) AS locales
FROM (VALUES (N'编号：'),(N'内径(mm)'),(N'外径(mm)'),(N'长度(mm)'),
             (N'炭棒内径'),(N'炭棒外径'),(N'炭棒长度'),
             (N'审核人（一级审批人）'),(N'审核人（二级审批人）'),(N'除余氯'),(N'重金属')) AS v(k)
ORDER BY v.k;
GO

PRINT N'i18n-rd-prodinfo-ui.sql 完成';
GO
