-- migrate-qcinsp-header-dept.sql — 来料检验单(QC_INSP)表头补「部门 + 部门编码」(2026-10-05)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 用户口径(2026-10-05):「来料检验单的表头缺少部门与部门编码」。
--
-- 背景:2026-09-30 migrate-qcinsp-header-fix.sql 消表头重复时,把 部门/部门名称 那两行的
--   place 从 'header,detail' 退回 'detail' ⇒ 表头从此没有部门(明细网格里仍在,且 部门 行 hidden)。
--
-- 口径(与用户确认,同采购入库单/材料出库单):
--   · 部门     = 参照 部门档案(DEPT,表 bs_dept)· ref_field=部门名称 ⇒ 存名称、按名称选
--   · 部门编码 = 参照 部门档案(DEPT)· ref_field=部门编码 ⇒ 存编码(转 ERP 取 dept_number 用)
--   两个都上表头、人工选(选部门时参照带回自动把编码一起写出来,见 PanelConfigService.REF_SYNONYMS
--   之外的**同名带回**机制:部门档案有 部门编码,本单也有 部门编码 ⇒ 自动映射)。
--   ⚠ **不随链带入**:用户口径「生单不用带入部门,这个生单是跨部门的」—— 暂收单是仓库口
--   (部门=仓库),来料检验单是品质口,两者不同部门,故 QC_RECV→QC_INSP 这一跳不带
--   部门/部门名称/部门编码(代码侧见 PanelConfigService.FLOW_LINK_EXCLUDE 与
--   ButtonService.syncInspFromSlRecv 的方法头注释)。
--
-- 幂等:列 IF COL_LENGTH IS NULL 才加;字段行 NOT EXISTS 才插;译名已有则跳过(两个标签的
--   9 语言译名 yj_translation 全局共享已有,这里只兜底补缺)。两账套均执行。
-- ═══════════════════════════════════════════════════════════════════════════════
SET NOCOUNT ON;
GO
-- ── 1. 表列兜底:qc_insp.部门编码(与同表 部门/部门名称/供应商代码 同口径 nvarchar(100) NULL) ──
IF COL_LENGTH('dbo.qc_insp', N'部门编码') IS NULL
    ALTER TABLE dbo.qc_insp ADD [部门编码] nvarchar(100) NULL;
GO
-- ── 2. 新增列中文注明(幂等;已有不覆盖) ──
IF COL_LENGTH('dbo.qc_insp', N'部门编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id = OBJECT_ID('dbo.qc_insp')
                      AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'部门编码', 'ColumnId')
                      AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'部门编码(表头,2026-10-05 补:参照部门档案 bs_dept 的 部门编码,选部门时随参照带回;转 ERP 取 dept_number 用)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'部门编码';
GO
IF COL_LENGTH('dbo.qc_insp', N'部门') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id = OBJECT_ID('dbo.qc_insp')
                      AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp'), N'部门', 'ColumnId')
                      AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'部门(表头,2026-10-05 上表头:参照部门档案 bs_dept 的 部门名称,存名称)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_insp', N'COLUMN', N'部门';
GO
-- ── 3. yj_field 补表头字段行(seq 85/88 = 紧随「供应商代码」80、在「检验员」90 之前) ──
--    表头行与明细行是**两行**(place 各自独立排序,09-30 治理确立的约定),明细那两行不动。
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'QC_INSP' AND col_name = N'部门' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                        place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'部门', N'部门', N'参照', 'DEPT', N'部门名称', N'部门名称', N'header', 85, 140, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'QC_INSP' AND col_name = N'部门编码' AND place LIKE '%header%')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                        place, seq, width, editable, required, hidden, visible)
  VALUES ('QC_INSP', N'部门编码', N'部门编码', N'参照', 'DEPT', N'部门编码', N'部门名称', N'header', 88, 140, 1, 0, 0, 1);
GO
-- ── 4. 确保两个字段**可见**(幂等自愈) ──
--    为什么要有这一段:yj_field 的 seq/hidden/visible 会被界面「表头调整」整体重写(saveHeaderPrefs
--    按提交顺序把所有表头字段归一为 seq=(i+1)*10,未勾选的置 hidden=1/visible=0)。2026-10-05 实测:
--    本脚本执行后仅几分钟,一次 QC_INSP 表头调整保存就把这两行改成了 hidden=1/visible=0(表头又看不见了)。
--    用户口径要的就是"表头有这两个字段",故这里只把**可见性**纠回来(seq 交给界面,不抢用户排的顺序)。
UPDATE yj_field SET hidden = 0, visible = 1
 WHERE panel_code = 'QC_INSP' AND col_name IN (N'部门', N'部门编码')
   AND place LIKE '%header%' AND (hidden <> 0 OR visible <> 1);
PRINT N'部门/部门编码 表头可见性纠回: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ── 5. 译名兜底(两个标签的 9 语言共享译名已存在 ⇒ 正常 0 行;新库按链跑时由本段补齐) ──
;WITH T(ref_key, locale, text) AS (
  SELECT N'部门', 'en', N'Department' UNION ALL SELECT N'部门', 'ja', N'部門'
  UNION ALL SELECT N'部门', 'ko', N'부서' UNION ALL SELECT N'部门', 'de', N'Abteilung'
  UNION ALL SELECT N'部门', 'es', N'Departamento' UNION ALL SELECT N'部门', 'fr', N'Département'
  UNION ALL SELECT N'部门', 'ru', N'Отдел' UNION ALL SELECT N'部门', 'th', N'แผนก'
  UNION ALL SELECT N'部门', 'vi', N'Phòng ban'
  UNION ALL SELECT N'部门编码', 'en', N'Department Code' UNION ALL SELECT N'部门编码', 'ja', N'部門コード'
  UNION ALL SELECT N'部门编码', 'ko', N'부서 코드' UNION ALL SELECT N'部门编码', 'de', N'Abteilungs codierung'
  UNION ALL SELECT N'部门编码', 'es', N'Codificación del departamento' UNION ALL SELECT N'部门编码', 'fr', N'Codage du secteur'
  UNION ALL SELECT N'部门编码', 'ru', N'Секторальные коды' UNION ALL SELECT N'部门编码', 'th', N'รหัสแผนก'
  UNION ALL SELECT N'部门编码', 'vi', N'Mã bộ phận'
)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', t.ref_key, t.locale, t.text, 'manual'
FROM T t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                   WHERE x.scope = 'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO
-- ── 6. 自检(不满足即报错,避免"跑了但没生效") ──
IF COL_LENGTH('dbo.qc_insp', N'部门编码') IS NULL
    RAISERROR(N'qc_insp.部门编码 列未建成', 16, 1);
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = 'QC_INSP' AND place LIKE '%header%' AND col_name IN (N'部门', N'部门编码')) <> 2
    RAISERROR(N'QC_INSP 表头的 部门/部门编码 字段行未登记齐', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND place LIKE '%header%'
            AND col_name IN (N'部门', N'部门编码') AND (hidden <> 0 OR visible <> 1))
    RAISERROR(N'QC_INSP 表头的 部门/部门编码 仍不可见(hidden/visible 未纠回)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'部门编码'
                AND ref_panel = 'DEPT' AND ref_field = N'部门编码' AND place LIKE '%header%')
    RAISERROR(N'QC_INSP 表头 部门编码 的参照未指向部门档案 DEPT', 16, 1);
IF EXISTS (SELECT 1 FROM (VALUES (N'部门'), (N'部门编码')) AS v(k)
            WHERE (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = v.k) < 9)
    RAISERROR(N'部门/部门编码 译名未齐 9 语言', 16, 1);
-- 结果快照:表头字段(按 seq)+ 两个字段行
SELECT id, place, seq, col_name, label, data_type, ref_panel, ref_field, display_field, hidden, visible
  FROM yj_field WHERE panel_code = 'QC_INSP' AND place LIKE '%header%' ORDER BY seq, id;
GO
PRINT N'✅ migrate-qcinsp-header-dept 完成:qc_insp.部门编码 列 + QC_INSP 表头 部门/部门编码';
GO
