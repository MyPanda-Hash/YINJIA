-- migrate-insp-rename.sql — 检验单改名 来料检验单(2026-09-15)
-- 口径:QC_INSP 面板名 检验单 → 来料检验单(对齐 legacy 称谓);面板编码/表结构/字段/菜单位置全部不变,
--       表头表体字段清单与现状一致(用户 2026-09-15 清单逐项核对,仅 物料代码 按系统惯例保持 物料编码)。
-- 行为变化(代码侧注册,ButtonService):审核 → 合格数量>0 的行自动生成采购入库单草稿;暂收退回单暂不创建。
-- 幂等:可重复执行。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-insp-rename.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-insp-rename.sql"
SET NOCOUNT ON;

-- 1. 面板改名(panel_code/表/字段不动;panel_name_en 同步换 Incoming Inspection Sheet)
UPDATE yj_panel SET panel_name = N'来料检验单', panel_name_en = N'Incoming Inspection Sheet' WHERE panel_code = 'QC_INSP' AND panel_name <> N'来料检验单';
GO

-- 2. 译名:旧名 检验单(panel) 收编改名;字段标签全部共享不动
DELETE FROM yj_translation WHERE scope = 'panel' AND ref_key = N'检验单';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'en', N'Incoming Inspection Sheet', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'ja', N'受入検査伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'ko', N'입고검사 전표', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'es', N'Hoja de inspección de entrada', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'fr', N'Fiche d''inspection à réception', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'de', N'Wareneingangsprüfung', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'ru', N'Лист входного контроля', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'vi', N'Phiếu kiểm nghiệm đầu vào', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'th', N'ใบตรวจรับของเข้า', 'manual');
GO

-- 3. 自检:改名生效 + 旧名残留为 0
SELECT panel_code, panel_name, panel_name_en FROM yj_panel WHERE panel_code = 'QC_INSP';
SELECT COUNT(*) AS old_name_left FROM yj_translation WHERE scope='panel' AND ref_key = N'检验单';
PRINT N'migrate-insp-rename 完成:检验单→来料检验单(字段零变化;审核自动生成采购入库单在代码侧)';
GO
