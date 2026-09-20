-- i18n-rd-progress-18cols.sql — RD_PROGRESS 18 列重构配套多语言(Phase 2)
--
-- 【为什么必须一起交付】AGENTS.md 硬性规定:新增/改动的字段必须同时交付多语言。
--   label 是译名键(scope='field')—— 本轮 RD_PROGRESS 界面上新增/改名了若干表头,
--   不同步补译名,英文界面就会显中文。
--
-- 本轮覆盖(实测:以下 label 的译名缺失或不全,只有 en 的补满 10 语言):
--   全新:开发复杂度 / 重要程度 / 项目定及变更 / 项目编号 / 未转换原因 / 项目发起人 /
--         项目负责人 / 立项日期 / 预计完成日期 / 测试情况 / 技术目标达成 / 是否市场转化
--   补满:内容(原仅 en)/ 子项目/尺寸(原仅 en)
--   已有 10 语言不动:项目定级 / 项目名称 / 状态 / 紧急程度
--
-- 幂等:NOT EXISTS 按 (scope, ref_key, locale) 去重,可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- ═══ 设计新增 4 列 ═══
  (N'开发复杂度', 'en', N'Development Complexity'), (N'开发复杂度', 'ja', N'開発複雑度'),
  (N'开发复杂度', 'ko', N'개발 복잡도'),            (N'开发复杂度', 'es', N'Complejidad de desarrollo'),
  (N'开发复杂度', 'fr', N'Complexité de développement'), (N'开发复杂度', 'de', N'Entwicklungskomplexität'),
  (N'开发复杂度', 'ru', N'Сложность разработки'),   (N'开发复杂度', 'vi', N'Độ phức tạp phát triển'),
  (N'开发复杂度', 'th', N'ความซับซ้อนในการพัฒนา'),   (N'开发复杂度', 'zh-TW', N'開發複雜度'),

  (N'重要程度', 'en', N'Importance'), (N'重要程度', 'ja', N'重要度'),
  (N'重要程度', 'ko', N'중요도'),     (N'重要程度', 'es', N'Importancia'),
  (N'重要程度', 'fr', N'Importance'), (N'重要程度', 'de', N'Wichtigkeit'),
  (N'重要程度', 'ru', N'Важность'),   (N'重要程度', 'vi', N'Mức độ quan trọng'),
  (N'重要程度', 'th', N'ความสำคัญ'),  (N'重要程度', 'zh-TW', N'重要程度'),

  -- 紧急程度:已有 10 语言,跳过(见上方说明)

  (N'项目定及变更', 'en', N'Project Grade & Changes'), (N'项目定及变更', 'ja', N'プロジェクト等級・変更'),
  (N'项目定及变更', 'ko', N'프로젝트 등급·변경'),       (N'项目定及变更', 'es', N'Grado y cambios del proyecto'),
  (N'项目定及变更', 'fr', N'Niveau et modifications du projet'), (N'项目定及变更', 'de', N'Projektstufe und Änderungen'),
  (N'项目定及变更', 'ru', N'Категория и изменения проекта'), (N'项目定及变更', 'vi', N'Cấp dự án và thay đổi'),
  (N'项目定及变更', 'th', N'ระดับและการเปลี่ยนแปลงโครงการ'), (N'项目定及变更', 'zh-TW', N'專案定及變更'),

  -- ═══ 由"只显示不落库"转为真落库的 3 列 ═══
  (N'技术目标达成', 'en', N'Technical Goal Achieved'), (N'技术目标达成', 'ja', N'技術目標達成'),
  (N'技术目标达成', 'ko', N'기술 목표 달성'),           (N'技术目标达成', 'es', N'Objetivo técnico alcanzado'),
  (N'技术目标达成', 'fr', N'Objectif technique atteint'), (N'技术目标达成', 'de', N'Technisches Ziel erreicht'),
  (N'技术目标达成', 'ru', N'Техническая цель достигнута'), (N'技术目标达成', 'vi', N'Đạt mục tiêu kỹ thuật'),
  (N'技术目标达成', 'th', N'บรรลุเป้าหมายทางเทคนิค'),   (N'技术目标达成', 'zh-TW', N'技術目標達成'),

  (N'是否市场转化', 'en', N'Market Conversion'), (N'是否市场转化', 'ja', N'市場転換'),
  (N'是否市场转化', 'ko', N'시장 전환'),          (N'是否市场转化', 'es', N'Conversión a mercado'),
  (N'是否市场转化', 'fr', N'Conversion en marché'), (N'是否市场转化', 'de', N'Marktumsetzung'),
  (N'是否市场转化', 'ru', N'Вывод на рынок'),    (N'是否市场转化', 'vi', N'Chuyển đổi thị trường'),
  (N'是否市场转化', 'th', N'การเปลี่ยนเป็นตลาด'), (N'是否市场转化', 'zh-TW', N'是否市場轉化'),

  (N'未转换原因', 'en', N'Reason for No Conversion'), (N'未转换原因', 'ja', N'未転換理由'),
  (N'未转换原因', 'ko', N'미전환 사유'),              (N'未转换原因', 'es', N'Motivo de no conversión'),
  (N'未转换原因', 'fr', N'Motif de non-conversion'), (N'未转换原因', 'de', N'Grund der Nichtumsetzung'),
  (N'未转换原因', 'ru', N'Причина невывода на рынок'), (N'未转换原因', 'vi', N'Lý do không chuyển đổi'),
  (N'未转换原因', 'th', N'เหตุผลที่ไม่เปลี่ยน'),      (N'未转换原因', 'zh-TW', N'未轉換原因'),

  -- ═══ 本轮复用但其译名缺失的列 ═══
  (N'项目编号', 'en', N'Project No.'), (N'项目编号', 'ja', N'プロジェクト番号'),
  (N'项目编号', 'ko', N'프로젝트 번호'), (N'项目编号', 'es', N'N.º de proyecto'),
  (N'项目编号', 'fr', N'N° de projet'), (N'项目编号', 'de', N'Projekt-Nr.'),
  (N'项目编号', 'ru', N'Номер проекта'), (N'项目编号', 'vi', N'Số dự án'),
  (N'项目编号', 'th', N'หมายเลขโครงการ'), (N'项目编号', 'zh-TW', N'專案編號'),

  (N'项目发起人', 'en', N'Project Initiator'), (N'项目发起人', 'ja', N'プロジェクト発起人'),
  (N'项目发起人', 'ko', N'프로젝트 발의자'),    (N'项目发起人', 'es', N'Promotor del proyecto'),
  (N'项目发起人', 'fr', N'Initiateur du projet'), (N'项目发起人', 'de', N'Projektinitiator'),
  (N'项目发起人', 'ru', N'Инициатор проекта'), (N'项目发起人', 'vi', N'Người khởi tạo dự án'),
  (N'项目发起人', 'th', N'ผู้ริเริ่มโครงการ'),  (N'项目发起人', 'zh-TW', N'專案發起人'),

  (N'项目负责人', 'en', N'Project Owner'), (N'项目负责人', 'ja', N'プロジェクト責任者'),
  (N'项目负责人', 'ko', N'프로젝트 책임자'), (N'项目负责人', 'es', N'Responsable del proyecto'),
  (N'项目负责人', 'fr', N'Responsable du projet'), (N'项目负责人', 'de', N'Projektverantwortlicher'),
  (N'项目负责人', 'ru', N'Ответственный за проект'), (N'项目负责人', 'vi', N'Người phụ trách dự án'),
  (N'项目负责人', 'th', N'ผู้รับผิดชอบโครงการ'), (N'项目负责人', 'zh-TW', N'專案負責人'),

  (N'立项日期', 'en', N'Initiation Date'), (N'立项日期', 'ja', N'立上げ日'),
  (N'立项日期', 'ko', N'착수일'),           (N'立项日期', 'es', N'Fecha de inicio'),
  (N'立项日期', 'fr', N'Date de lancement'), (N'立项日期', 'de', N'Startdatum'),
  (N'立项日期', 'ru', N'Дата открытия'),   (N'立项日期', 'vi', N'Ngày khởi tạo'),
  (N'立项日期', 'th', N'วันที่เริ่มโครงการ'), (N'立项日期', 'zh-TW', N'立項日期'),

  (N'预计完成日期', 'en', N'Expected Completion Date'), (N'预计完成日期', 'ja', N'完了予定日'),
  (N'预计完成日期', 'ko', N'완료 예정일'),               (N'预计完成日期', 'es', N'Fecha prevista de finalización'),
  (N'预计完成日期', 'fr', N'Date d''achèvement prévue'), (N'预计完成日期', 'de', N'Voraussichtliches Enddatum'),
  (N'预计完成日期', 'ru', N'Планируемая дата завершения'), (N'预计完成日期', 'vi', N'Ngày hoàn thành dự kiến'),
  (N'预计完成日期', 'th', N'วันที่คาดว่าจะเสร็จ'),        (N'预计完成日期', 'zh-TW', N'預計完成日期'),

  (N'测试情况', 'en', N'Test Status'), (N'测试情况', 'ja', N'テスト状況'),
  (N'测试情况', 'ko', N'테스트 현황'),  (N'测试情况', 'es', N'Estado de pruebas'),
  (N'测试情况', 'fr', N'État des tests'), (N'测试情况', 'de', N'Teststatus'),
  (N'测试情况', 'ru', N'Состояние испытаний'), (N'测试情况', 'vi', N'Tình trạng thử nghiệm'),
  (N'测试情况', 'th', N'สถานะการทดสอบ'), (N'测试情况', 'zh-TW', N'測試情況'),

  -- ═══ 原有但只覆盖 en 的 2 列,补满 ═══
  (N'内容', 'ja', N'内容'), (N'内容', 'ko', N'내용'), (N'内容', 'es', N'Contenido'),
  (N'内容', 'fr', N'Contenu'), (N'内容', 'de', N'Inhalt'), (N'内容', 'ru', N'Содержание'),
  (N'内容', 'vi', N'Nội dung'), (N'内容', 'th', N'เนื้อหา'), (N'内容', 'zh-TW', N'內容'),

  (N'子项目/尺寸', 'ja', N'サブプロジェクト/寸法'), (N'子项目/尺寸', 'ko', N'하위 프로젝트/치수'),
  (N'子项目/尺寸', 'es', N'Subproyecto/Medidas'),   (N'子项目/尺寸', 'fr', N'Sous-projet/Dimensions'),
  (N'子项目/尺寸', 'de', N'Teilprojekt/Abmessungen'), (N'子项目/尺寸', 'ru', N'Подпроект/Размеры'),
  (N'子项目/尺寸', 'vi', N'Tiểu dự án/Kích thước'), (N'子项目/尺寸', 'th', N'โครงการย่อย/ขนาด'),
  (N'子项目/尺寸', 'zh-TW', N'子專案/尺寸')
) AS v(ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = 'field' AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- 核对:RD_PROGRESS 界面用到的 18 个表头,各自译名覆盖数(应全部 = 10)
SELECT v.ref_key, (SELECT COUNT(*) FROM yj_translation t
                   WHERE t.scope='field' AND t.ref_key = v.ref_key) AS locales
FROM (VALUES
  (N'项目定级'),(N'项目名称'),(N'子项目/尺寸'),(N'项目编号'),
  (N'开发复杂度'),(N'重要程度'),(N'紧急程度'),(N'内容'),
  (N'项目发起人'),(N'项目负责人'),(N'立项日期'),(N'预计完成日期'),
  (N'项目定及变更'),(N'状态'),(N'测试情况'),
  (N'技术目标达成'),(N'是否市场转化'),(N'未转换原因')
) AS v(ref_key)
ORDER BY locales, v.ref_key;
GO

PRINT N'i18n-rd-progress-18cols.sql 完成';
GO
