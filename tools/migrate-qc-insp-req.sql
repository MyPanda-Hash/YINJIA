-- migrate-qc-insp-req.sql — 来料品质「来料检验要求」面板(7 物料检验要求表,一面板 7 页签)
-- 依据《品质资料 2026.09.19.xlsx》自「折叠棉」页签起的 7 张检验要求表(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉)
-- 一比一复刻:前端 QcInspReqSheet(规格书式页签 + 加标水式 Excel 网格,core/views/qcInspReqConfig.js 配置驱动)。
-- 形态:档案式全局资料表(mode='archive',整表加载/整表 upsert),非翻页单据——Excel 原表即一张全局表,
--       无单据编号/日期/审批;查询=queryArchive 全量,保存=saveArchive 按行 id upsert+缺席行软删。
-- 存储:一张并集宽表(规格书 rd_spec_doc_detail 同款「表区」思路)——同名叶列跨页签共用一列
--       (实配炭棒后外径=折叠棉/网套,折数=折叠棉/网套,尺寸/实配端盖=网套/PP棉,脏污、头发丝=6 个页签共用),
--       页签行以 [物料类别] 区分;PP管 原表 B 列为全空杂列,未建列。
-- 幂等:表已建跳过;yj_field 每次重建;种子仅在表空(无存活行)时播种,防复活用户删过的行。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-qc-insp-req.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-qc-insp-req.sql"
SET NOCOUNT ON;

-- ═════════════ 1. 检验要求表(并集宽表,中文列=各页签字段 label) ═════════════
IF OBJECT_ID('qc_insp_req') IS NULL CREATE TABLE qc_insp_req (
  id int IDENTITY(1,1) PRIMARY KEY,
  [物料类别] nvarchar(20) NOT NULL,      -- 页签:折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉
  [物料编号] nvarchar(60) NOT NULL,
  [折叠棉] nvarchar(200) NULL,           -- 折叠棉·规格
  [炭棒] nvarchar(200) NULL,             -- 折叠棉·规格
  [实配炭棒后外径] nvarchar(100) NULL,   -- 折叠棉·规格 / 网套·规格
  [折数] nvarchar(100) NULL,             -- 折叠棉 / 网套
  [折高] nvarchar(100) NULL,             -- 折叠棉
  [叠高] nvarchar(100) NULL,             -- 网套
  [外径] nvarchar(100) NULL,             -- 垫片·规格 / PP管·规格
  [内径] nvarchar(100) NULL,             -- 垫片·规格 / PP管·规格
  [厚度] nvarchar(100) NULL,             -- 垫片·规格
  [实配端盖效果] nvarchar(200) NULL,     -- 垫片
  [材质] nvarchar(100) NULL,             -- 垫片·外观
  [长] nvarchar(100) NULL,               -- 无纺布·规格(片布) / PP管·规格
  [宽] nvarchar(100) NULL,               -- 无纺布·规格(片布)
  [克数] nvarchar(100) NULL,             -- 无纺布·规格(片布)
  [宽度] nvarchar(100) NULL,             -- 无纺布·规格(卷布)
  [克重] nvarchar(100) NULL,             -- 无纺布·规格(卷布)
  [颜色（白/黑）] nvarchar(50) NULL,     -- 无纺布·外观
  [尺寸] nvarchar(200) NULL,             -- 网套·规格 / PP棉·规格
  [实配端盖] nvarchar(200) NULL,         -- 网套·规格 / PP棉·规格
  [接口牢固度] nvarchar(200) NULL,       -- 网套·外观
  [破损、切斜] nvarchar(200) NULL,       -- PP管·外观
  [外径1] nvarchar(100) NULL,            -- 端盖·规格
  [外径2] nvarchar(100) NULL,            -- 端盖·规格
  [高度] nvarchar(100) NULL,             -- 端盖·规格
  [外径（+密封圈）] nvarchar(100) NULL,  -- 端盖·外观(原表即归在外观组)
  [出水口堵孔、批锋] nvarchar(200) NULL, -- 端盖·外观
  [变形、破损] nvarchar(200) NULL,       -- 端盖·外观
  [实配炭棒] nvarchar(200) NULL,         -- PP棉·规格
  [切面（平整、无歪斜）] nvarchar(200) NULL, -- PP棉·外观
  [破损、变形] nvarchar(200) NULL,       -- PP棉·外观
  [脏污、头发丝] nvarchar(200) NULL,     -- 垫片/无纺布/网套/PP管/端盖/PP棉·外观共用
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ═════════════ 2. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'qc_insp_req';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料检验要求表(品质资料 7 张检验要求表并集:折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉;档案式全局资料,无单据号;物料类别=页签)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料检验要求表(品质资料 7 张检验要求表并集:折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉;档案式全局资料,无单据号;物料类别=页签)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'物料类别',           N'物料类别=面板页签(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉;下拉框)'),
  (N'物料编号',           N'物料编号(页签内主键,YJ-YCYX/YJ-TS/YJ-AJ/YJ-JB 等)'),
  (N'折叠棉',             N'折叠棉·规格(外形尺寸)'),
  (N'炭棒',               N'折叠棉·规格(实配炭棒尺寸)'),
  (N'实配炭棒后外径',     N'实配炭棒后外径(折叠棉/网套共用;规格组)'),
  (N'折数',               N'折数(折叠棉/网套共用)'),
  (N'折高',               N'折高(折叠棉)'),
  (N'叠高',               N'叠高(网套)'),
  (N'外径',               N'外径(垫片/PP管共用;规格组)'),
  (N'内径',               N'内径(垫片/PP管共用;规格组)'),
  (N'厚度',               N'厚度(垫片;规格组)'),
  (N'实配端盖效果',       N'实配端盖效果(垫片)'),
  (N'材质',               N'材质(垫片;外观组)'),
  (N'长',                 N'长(无纺布 片布规格 / PP管 规格)'),
  (N'宽',                 N'宽(无纺布 片布规格)'),
  (N'克数',               N'克数(无纺布 片布规格)'),
  (N'宽度',               N'宽度(无纺布 卷布规格)'),
  (N'克重',               N'克重(无纺布 卷布规格)'),
  (N'颜色（白/黑）',      N'颜色 白/黑(无纺布;外观组)'),
  (N'尺寸',               N'尺寸(网套/PP棉共用;规格组)'),
  (N'实配端盖',           N'实配端盖(网套/PP棉共用;规格组)'),
  (N'接口牢固度',         N'接口牢固度(网套;外观组)'),
  (N'破损、切斜',         N'破损、切斜(PP管;外观组)'),
  (N'外径1',              N'外径1(端盖;规格组)'),
  (N'外径2',              N'外径2(端盖;规格组)'),
  (N'高度',               N'高度(端盖;规格组)'),
  (N'外径（+密封圈）',    N'外径(+密封圈)(端盖;原表归外观组)'),
  (N'出水口堵孔、批锋',   N'出水口堵孔、批锋(端盖;外观组)'),
  (N'变形、破损',         N'变形、破损(端盖;外观组)'),
  (N'实配炭棒',           N'实配炭棒(PP棉;规格组)'),
  (N'切面（平整、无歪斜）', N'切面 平整无歪斜(PP棉;外观组)'),
  (N'破损、变形',         N'破损、变形(PP棉;外观组)'),
  (N'脏污、头发丝',       N'脏污、头发丝(垫片/无纺布/网套/PP管/端盖/PP棉 外观组共用)');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═════════════ 3. 面板注册(档案式:整表加载/整表 upsert;无单据号/审批) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP_REQ')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'QC_INSP_REQ', N'来料检验要求', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求' AND locale='en'),
       N'档案', 'archive', 'qc_insp_req', NULL, NULL, N'id', NULL, NULL, NULL, 100, N'items', N'品质管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP_REQ');
GO

-- ═════════════ 4. 字段注册(label=列名;宽=Excel 原列宽 px;值列全部文本——±/区间是文本) ═════════════
DELETE FROM yj_field WHERE panel_code = 'QC_INSP_REQ';
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('QC_INSP_REQ', N'物料类别', N'物料类别', N'下拉框', N'SELECT v FROM (VALUES (N''折叠棉''),(N''垫片''),(N''无纺布''),(N''网套''),(N''PP管''),(N''端盖''),(N''PP棉'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 10, 90, 1, 1, 0, 1),
('QC_INSP_REQ', N'物料编号', N'物料编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 130, 1, 1, 0, 1),
('QC_INSP_REQ', N'折叠棉', N'折叠棉', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, 1),
('QC_INSP_REQ', N'炭棒', N'炭棒', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 140, 1, 0, 0, 1),
('QC_INSP_REQ', N'实配炭棒后外径', N'实配炭棒后外径', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 140, 1, 0, 0, 1),
('QC_INSP_REQ', N'折数', N'折数', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 125, 1, 0, 0, 1),
('QC_INSP_REQ', N'折高', N'折高', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 125, 1, 0, 0, 1),
('QC_INSP_REQ', N'叠高', N'叠高', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 83, 1, 0, 0, 1),
('QC_INSP_REQ', N'外径', N'外径', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 101, 1, 0, 0, 1),
('QC_INSP_REQ', N'内径', N'内径', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 101, 1, 0, 0, 1),
('QC_INSP_REQ', N'厚度', N'厚度', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 123, 1, 0, 0, 1),
('QC_INSP_REQ', N'实配端盖效果', N'实配端盖效果', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 83, 1, 0, 0, 1),
('QC_INSP_REQ', N'材质', N'材质', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'长', N'长', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 101, 1, 0, 0, 1),
('QC_INSP_REQ', N'宽', N'宽', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 101, 1, 0, 0, 1),
('QC_INSP_REQ', N'克数', N'克数', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 123, 1, 0, 0, 1),
('QC_INSP_REQ', N'宽度', N'宽度', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 83, 1, 0, 0, 1),
('QC_INSP_REQ', N'克重', N'克重', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 83, 1, 0, 0, 1),
('QC_INSP_REQ', N'颜色（白/黑）', N'颜色（白/黑）', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'尺寸', N'尺寸', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 118, 1, 0, 0, 1),
('QC_INSP_REQ', N'实配端盖', N'实配端盖', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 118, 1, 0, 0, 1),
('QC_INSP_REQ', N'接口牢固度', N'接口牢固度', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'破损、切斜', N'破损、切斜', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'外径1', N'外径1', N'文本', NULL, NULL, NULL, NULL, N'detail', 240, 101, 1, 0, 0, 1),
('QC_INSP_REQ', N'外径2', N'外径2', N'文本', NULL, NULL, NULL, NULL, N'detail', 250, 123, 1, 0, 0, 1),
('QC_INSP_REQ', N'高度', N'高度', N'文本', NULL, NULL, NULL, NULL, N'detail', 260, 81, 1, 0, 0, 1),
('QC_INSP_REQ', N'外径（+密封圈）', N'外径（+密封圈）', N'文本', NULL, NULL, NULL, NULL, N'detail', 270, 118, 1, 0, 0, 1),
('QC_INSP_REQ', N'出水口堵孔、批锋', N'出水口堵孔、批锋', N'文本', NULL, NULL, NULL, NULL, N'detail', 280, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'变形、破损', N'变形、破损', N'文本', NULL, NULL, NULL, NULL, N'detail', 290, 116, 1, 0, 0, 1),
('QC_INSP_REQ', N'实配炭棒', N'实配炭棒', N'文本', NULL, NULL, NULL, NULL, N'detail', 300, 146, 1, 0, 0, 1),
('QC_INSP_REQ', N'切面（平整、无歪斜）', N'切面（平整、无歪斜）', N'文本', NULL, NULL, NULL, NULL, N'detail', 310, 119, 1, 0, 0, 1),
('QC_INSP_REQ', N'破损、变形', N'破损、变形', N'文本', NULL, NULL, NULL, NULL, N'detail', 320, 119, 1, 0, 0, 1),
('QC_INSP_REQ', N'脏污、头发丝', N'脏污、头发丝', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 116, 1, 0, 0, 1);
GO

-- ═════════════ 5. 译名(其余语言由机翻兜底;字段标签全局共享,已有译名的键 NOT EXISTS 跳过) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验要求', 'en', N'Incoming Inspection Requirements', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求' AND locale='zh-TW')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验要求', 'zh-TW', N'來料檢驗要求', 'manual');

DECLARE @ft TABLE (k nvarchar(100), en nvarchar(200), tw nvarchar(200));
INSERT INTO @ft VALUES
 (N'物料类别',           N'Material Category',              N'物料類別'),
 (N'折叠棉',             N'Folded Cotton',                  N'折疊棉'),
 (N'炭棒',               N'Carbon Rod',                     N'炭棒'),
 (N'实配炭棒后外径',     N'Assembled OD (Carbon Rod)',      N'實配炭棒後外徑'),
 (N'折数',               N'Number of Folds',                N'摺數'),
 (N'折高',               N'Fold Height',                    N'摺高'),
 (N'叠高',               N'Stack Height',                   N'疊高'),
 (N'外径',               N'OD',                             N'外徑'),
 (N'内径',               N'ID',                             N'內徑'),
 (N'厚度',               N'Thickness',                      N'厚度'),
 (N'实配端盖效果',       N'End Cap Fit Result',             N'實配端蓋效果'),
 (N'材质',               N'Material',                       N'材質'),
 (N'长',                 N'Length',                         N'長'),
 (N'宽',                 N'Width',                          N'寬'),
 (N'克数',               N'Weight (g)',                     N'克數'),
 (N'宽度',               N'Width (Roll)',                   N'寬度'),
 (N'克重',               N'GSM',                            N'克重'),
 (N'颜色（白/黑）',      N'Color (White/Black)',            N'顏色（白/黑）'),
 (N'实配端盖',           N'End Cap Fit',                    N'實配端蓋'),
 (N'接口牢固度',         N'Joint Strength',                 N'接口牢固度'),
 (N'破损、切斜',         N'Damage / Skew Cut',              N'破損、切斜'),
 (N'外径1',              N'OD 1',                           N'外徑1'),
 (N'外径2',              N'OD 2',                           N'外徑2'),
 (N'高度',               N'Height',                         N'高度'),
 (N'外径（+密封圈）',    N'OD (+ Seal Ring)',               N'外徑（+密封圈）'),
 (N'出水口堵孔、批锋',   N'Outlet Blocking / Flash',        N'出水口堵孔、批鋒'),
 (N'变形、破损',         N'Deformation / Damage',           N'變形、破損'),
 (N'实配炭棒',           N'Carbon Rod Fit',                 N'實配炭棒'),
 (N'切面（平整、无歪斜）', N'Cut Face (Flat, No Skew)',     N'切面（平整、無歪斜）'),
 (N'破损、变形',         N'Damage / Deformation',           N'破損、變形'),
 (N'脏污、头发丝',       N'Stains / Hair',                  N'髒污、頭髮絲'),
 (N'规格（片布）',       N'Spec (Sheet)',                   N'規格（片布）'),
 (N'规格（卷布）',       N'Spec (Roll)',                    N'規格（卷布）'),
 (N'折叠棉检验要求',     N'Folded Cotton Inspection Requirements',   N'折疊棉檢驗要求'),
 (N'垫片/密封圈检验要求', N'Gasket / Seal Ring Inspection Requirements', N'墊片/密封圈檢驗要求'),
 (N'无纺布检验要求',     N'Non-woven Fabric Inspection Requirements', N'無紡布檢驗要求'),
 (N'网套检验要求',       N'Mesh Sleeve Inspection Requirements',      N'網套檢驗要求'),
 (N'PP胶管检验要求',     N'PP Tube Inspection Requirements',          N'PP膠管檢驗要求'),
 (N'端盖检验要求',       N'End Cap Inspection Requirements',          N'端蓋檢驗要求'),
 (N'PP棉检验要求',       N'PP Cotton Inspection Requirements',        N'PP棉檢驗要求'),
 (N'垫片',               N'Gasket',                         N'墊片'),
 (N'无纺布',             N'Non-woven Fabric',               N'無紡布'),
 (N'网套',               N'Mesh Sleeve',                    N'網套'),
 (N'PP管',               N'PP Tube',                        N'PP管'),
 (N'端盖',               N'End Cap',                        N'端蓋'),
 (N'PP棉',               N'PP Cotton',                      N'PP棉');

DECLARE @k nvarchar(100), @e nvarchar(200), @w nvarchar(200);
DECLARE fcur CURSOR LOCAL FAST_FORWARD FOR SELECT k, en, tw FROM @ft;
OPEN fcur; FETCH NEXT FROM fcur INTO @k, @e, @w;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=@k AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', @k, 'en', @e, 'manual');
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=@k AND locale='zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', @k, 'zh-TW', @w, 'manual');
  FETCH NEXT FROM fcur INTO @k, @e, @w;
END
CLOSE fcur; DEALLOCATE fcur;
GO
-- 面板行的 panel_name_en 回填(INSERT 子查询先于译名段执行时为空,统一补齐;<> 判断重跑可跟上改译名)
UPDATE yj_panel SET panel_name_en = (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求' AND locale='en')
WHERE panel_code = 'QC_INSP_REQ'
  AND ISNULL(panel_name_en, N'') <> (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求' AND locale='en');
GO

-- ═════════════ 6. 全角色默认 view,query(品质维护权=组织架构按角色勾 add/modify/del;管理员恒全量) ═════════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'QC_INSP_REQ', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id=r.id AND rp.panel_code='QC_INSP_REQ');
GO

-- ═════════════ 7. 种子(《品质资料 2026.09.19.xlsx》现有行;仅在表空时播种) ═════════════
IF NOT EXISTS (SELECT 1 FROM qc_insp_req WHERE ISNULL(asp_cancel,'N') <> 'Y')
BEGIN
INSERT INTO qc_insp_req ([物料类别],[物料编号],[折叠棉],[炭棒],[实配炭棒后外径],[折数],[折高],[叠高],[外径],[内径],[厚度],[实配端盖效果],[材质],[长],[宽],[克数],[宽度],[克重],[颜色（白/黑）],[尺寸],[实配端盖],[接口牢固度],[破损、切斜],[外径1],[外径2],[高度],[外径（+密封圈）],[出水口堵孔、批锋],[变形、破损],[实配炭棒],[切面（平整、无歪斜）],[破损、变形],[脏污、头发丝]) VALUES
  (N'折叠棉', N'YJ-YCYX-006', N'47*34*154-1', N'34*12*154', NULL, N'75±5', N'6--7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-008', N'48*34*263-1', N'37*23*263', N'47.5-48.5', N'73±5', N'5--6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-009', N'70*53*241', N'53*16*241', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-011', N'68*49*208-1', N'48*30*208', NULL, N'100±5', N'9--10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-012', N'46*34*248.5-1', N'34*12*248.5', NULL, N'70±5', N'5.5-6.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-016', N'70*50*293-1', N'50*30*293', N'69.5-70.5', N'95-105', N'9.5-10.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-019', N'48*34*188-1mm', N'34*12*188', N'47.5-48.5', N'70-80', N'6.5-7.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-020', N'72*60*120-1', N'60*40*120', NULL, N'145-155', N'5.5-6.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-021', N'83*72*125-1', N'71*44*125', NULL, N'170-190', N'5--6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-022', N'47*34*230', N'34*162*230', N'48-49', N'75-85', N'6.5-7.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-023', N'109*81*239', N'80*35*239.5', N'107-108', N'135-145', N'13.5-14.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-025', N'63*48.5*242-1', N'48*30*241.5', N'62-64', N'105-115', N'6.7-7.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-026', N'63*48.5*242-1', N'48*30*241.5', N'62-64', N'95-105', N'6.7-7.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-027', N'63*48.5*231±1', N'48*30*231', N'62.5-63.5', N'55-65', N'6.5-7.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-028', N'58.5*48*175±0.5', N'48*25*175', N'58.7-59.7', N'113-123', N'4.7-5.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-029', N'58.5*48*288±0.5', N'48*25*288', N'58.7-59.7', N'113-123', N'4.7-5.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-031', N'98.5*88*159-1', N'88.8*68.5*159', N'98-99', N'175-195', N'4.7-5.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-032', N'63*48.5*242-1', N'48*30*241.5', N'62-64', N'85-95', N'6.7-5.7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-033', N'71*50*157±0.5', N'50*25*157.5', N'70-72', N'95-105', N'10.5±0.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-034', N'63*48.5*241-1', N'48*31*241.7', N'62-64', N'90-100', N'7.2±0.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-035', N'45*34*207±0.5', N'34*12*207', N'44.5-45.5', N'80-95', N'4.5-5.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-036', N'55*45*216-1', N'45*22*216', N'54-55', N'110-120', N'4.5-5.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-037', N'82*63*187', N'63*40*187', NULL, N'115-125', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-038', N'65*48.5*246.5', N'48*30*247.3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'折叠棉', N'YJ-YCYX-039', N'97*79*248', N'80*35*248.5', N'97-98', N'167-177', N'8.5-9.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP管', N'YJ-JB-001', NULL, NULL, NULL, NULL, NULL, NULL, N'8.1±0.1', N'6±0.2', NULL, NULL, NULL, N'274.5±0.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-001', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*284.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-002', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'40*28.7*178', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'44.5*28.7*199.3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-004', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'44.1*28.7*215.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-005', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'44.1*28.7*201.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-006', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'63*49*242', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-007', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'53*41*226.3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-008', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'53.5*41*260', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-009', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-010', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'59*45.5*210', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-011', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*216', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-012', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'58*45*242', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-013', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'44.5*28.7*212', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-014', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'61*49*231', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-015', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*148', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-016', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'49*34.5*160', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-017', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'60*45*229', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-018', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'60*28*253', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-019', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'48*28.7*180', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-020', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'66*49*227.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-021', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*498.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-022', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'48*34.5*197', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-023', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*199.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-024', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'65*49*244.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-025', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'42*30*284.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-026', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'48*34.5*249', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-027', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'41*33*194', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-028', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'48*30*190', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-029', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'66*49*226.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-030', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'44.1*28.7*215', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-TS-031', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'49*39*249.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-001', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'5*8.5*500', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-002', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'5.2*11.5*500', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'63.1*69*149/44.5*49*149', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-004', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'33*41*194', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-005', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'53*41*80', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-006', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'41.1*51*168.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-007', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'60.5*65*180', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-008', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'41*46.5*220', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-009', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'53*41*79.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-010', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'14*29*293', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-011', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'10*15*79.1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-012', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-013', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'30*34*102', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-014', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'49*41*249.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-015', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'10.5*21*234', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-016', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'63.1*69*149.5/44.5*49*149.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-017', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'33*41*204', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-018', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'19*21*216', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-019', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'11.5*15*53.5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (N'PP棉', N'YJ-AJ-020', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, N'33*41*194', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
END
GO

PRINT N'来料检验要求面板(QC_INSP_REQ)迁移完成';
GO

-- ═════════════ 验证 ═════════════
SELECT 'panel' AS what, COUNT(*) AS cnt FROM yj_panel WHERE panel_code='QC_INSP_REQ'
UNION ALL SELECT 'field', COUNT(*) FROM yj_field WHERE panel_code='QC_INSP_REQ'
UNION ALL SELECT 'role_perm', COUNT(*) FROM yj_role_panel WHERE panel_code='QC_INSP_REQ'
UNION ALL SELECT 'seed_rows', COUNT(*) FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'tr_panel', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验要求'
UNION ALL SELECT 'tr_field', COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key IN (SELECT label FROM yj_field WHERE panel_code='QC_INSP_REQ');
GO
