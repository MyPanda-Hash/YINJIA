-- migrate-bin-on-purchase-in-20261009.sql — 采购入库明细启用「仓位」+ 仓位默认标记 + 物料默认仓位可见
--
-- 用户口径(2026-10-09):
--   ① 采购入库明细要有「仓位」字段,并且**和「仓库」字段有联系**(选仓库后仓位候选只出该仓的仓位);
--   ② 需要**预设仓位** —— 选定口径「物料默认 ⇢ 仓库默认兜底」;
--   ③ 「启用仓位管理」**逐仓开启**,开了的仓才要求填仓位。
--
-- 现状(2026-10-09 取证 tools/archive/_pull-20261009/_q-pin-whloc*.sql):
--   · bl_purchase_in 仓位类物理列**早就有**(仓位名称/仓位编码/仓位id/仓库启用仓位管理),但
--     yj_field 对应那几行全是 hidden=1/visible=0 ⇒ 界面看不到;274 行数据里仓位列**全空**;
--   · bs_inv 有 默认仓位/默认仓库 列且**已登记 yj_field 但 hidden=1** ⇒ 商品档案上填不了;
--   · bs_wh_loc(仓位档案 679 个,只落在 A仓/CK-A 259、成品B仓/CP-02 180、C仓/CK-C 72、D仓/CK-D 168)
--     **没有「默认」标记列**;
--   · bs_wh.启用仓位管理 10 个仓全是「否」(界面上可见可勾,不用改元数据)。
--
-- 本脚本只做「数据层就地能做的四件事」:
--   ① bs_wh_loc 加 `是否默认` bit NOT NULL DEFAULT 0 + 中文注明(一个仓标一个默认位即可,不强制唯一——取编码序最小);
--   ② yj_field:WHLOC 登记「是否默认」(是否,紧随 停用) → 仓位档案上能勾默认;
--   ③ yj_field:PURCHASE_IN 明细「仓位名称」(文本/隐藏)就地改造成 **「仓位」参照**——
--      data_type=参照、ref_panel=WHLOC、ref_field/display_field=仓位编码、
--      **ref_filter=`仓库=$仓库`**(值以 `$字段名` 引用本行字段,前端参照弹窗按本行仓库收窄候选)、
--      seq=195(紧跟 仓库(190))、hidden=0、visible=1;物理列用 `仓位编码`(存仓位编码,与 仓库 存名称同款口径);
--   ④ yj_field:INV「默认仓位」取消隐藏并改「参照 WHLOC.仓位编码」⇒ 商品档案上可按物料预设仓位。
--
-- 配套代码(同批提交):ButtonService 生单预设(inspAutoPurchaseIn / tcInApprovedGenerate 按
--   「物料默认 ⇢ 该仓默认」补行仓位;仅当该仓 启用仓位管理=1 才预设)+ 明细必填校验补「逐仓必填」;
--   前端 engine.queryRefRows 支持 `$字段` 占位 + RefPickDialog 透传本行。
--
-- ⚠ 采购入库单是「采购链四单基线」之一:本脚本落地后必须重跑
--   node tools/archive/_gen-fourdoc-restore.mjs(刷 ①回正脚本 ②tools/fourdoc-baseline.tsv)
--   与 node tools/archive/_gen-doc-fields-md.mjs(回写 docs/development/采购链四单字段与显示字段.md),
--   并确认 §四 12/12 ✅、FourDocAudit 两账套 PASS。
--
-- 幂等:加列 COL_LENGTH 守卫 / 字段按 (panel_code,col_name) NOT EXISTS / 改造按「旧标签+旧列名」窄条件
--       (改完再跑匹配不到 ⇒ 0 行)/ 译名按唯一键 (scope,ref_key,locale);末尾自检。
SET NOCOUNT ON;

/* ---------- ① bs_wh_loc:是否默认 ---------- */
IF COL_LENGTH('dbo.bs_wh_loc', N'是否默认') IS NULL
    ALTER TABLE dbo.bs_wh_loc ADD [是否默认] bit NOT NULL CONSTRAINT DF_bs_wh_loc_isdefault DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_wh_loc')
               AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh_loc'), N'是否默认', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'是否默认:勾选=本仓的默认仓位(采购入库单生单预设仓位时,物料档案未指定默认仓位则取本仓这个位)。仓与位的数量级(679 个位)不适合逐个商品配默认,故仓库级给一个兜底位;同一仓建议只勾一个,多个时取仓位编码最小者',
        N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'是否默认';

/* ---------- ② yj_field:WHLOC 登记「是否默认」 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'WHLOC' AND col_name = N'是否默认')
    INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (N'WHLOC', N'是否默认', N'是否默认', N'Default', N'是否', NULL, NULL, NULL, NULL,
            N'detail', 62, 80, 1, 0, 0, 1);

/* ---------- ③ yj_field:采购入库明细「仓位」参照(就地改造旧行) ---------- */
-- 定位旧行:panel=PURCHASE_IN、detail、列名与标签都还是「仓位名称」且是隐藏文本 —— 窄条件,不误伤;
-- 改造后条件不再成立(幂等:二次执行 0 行)。
UPDATE yj_field SET
       col_name      = N'仓位编码',
       label         = N'仓位',
       label_en      = N'Bin',
       data_type     = N'参照',
       ref_panel     = N'WHLOC',
       ref_field     = N'仓位编码',
       display_field = N'仓位编码',
       ref_filter    = N'仓库=$仓库',          -- 值以 $字段名 引用本行字段;前端参照弹窗据此收窄候选
       place         = N'detail',
       seq           = 195,                     -- 紧跟 仓库(190)
       width         = 120,
       editable      = 1,
       required      = 0,                       -- 必填是「逐仓」条件性的,由后端保存校验兜(见 ButtonService)
       hidden        = 0,
       visible       = 1
 WHERE panel_code = N'PURCHASE_IN' AND place LIKE N'%detail%'
   AND col_name = N'仓位名称' AND label = N'仓位名称';
PRINT N'[bin-purchase-in] ③ 采购入库明细「仓位」改造行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ---------- ④ yj_field:INV「默认仓位」可见 + 改参照 ---------- */
UPDATE yj_field SET
       label_en      = N'Default Bin',
       data_type     = N'参照',
       ref_panel     = N'WHLOC',
       ref_field     = N'仓位编码',
       display_field = N'仓位编码',
       hidden        = 0,
       visible       = 1
 WHERE panel_code = N'INV' AND col_name = N'默认仓位' AND data_type = N'文本' AND hidden = 1;
PRINT N'[bin-purchase-in] ④ 商品档案「默认仓位」放开行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ---------- ⑤ 译名(多语言强制规范;已有则不重插) ---------- */
-- ⑤-1 顺手修两处**既有劣译**(2026-10-09 取证 q-11 记录在案):金蝶字段名被当成译名用了
UPDATE yj_translation SET text = N'Bin'      WHERE scope = 'field' AND ref_key = N'仓位'     AND locale = 'en' AND text = N'Bill Sp Name';
UPDATE yj_translation SET text = N'Bin Code' WHERE scope = 'field' AND ref_key = N'仓位编码' AND locale = 'en' AND text = N'Sp Number';
UPDATE yj_translation SET text = N'Default Bin' WHERE scope = 'field' AND ref_key = N'默认仓位' AND locale = 'en' AND text = N'Space Id';

-- ⑤-2 补齐/新增词条
DECLARE @tr TABLE (k nvarchar(120), loc varchar(10), txt nvarchar(200));
INSERT INTO @tr (k, loc, txt) VALUES
 (N'仓位',     'en',    N'Bin'),                 (N'仓位',     'ja', N'ロケーション'),
 (N'仓位',     'zh-TW', N'倉位'),                (N'仓位',     'ko', N'저장 위치'),
 (N'仓位',     'de',    N'Lagerplatz'),          (N'仓位',     'es', N'Ubicación de almacenamiento'),
 (N'仓位',     'fr',    N'Emplacement de stockage'), (N'仓位',  'ru', N'Место хранения'),
 (N'仓位',     'th',    N'ตำแหน่งจัดเก็บ'),       (N'仓位',     'vi', N'Vị trí lưu trữ'),
 (N'仓位编码', 'en',    N'Bin Code'),            (N'仓位编码', 'ja', N'ロケーションコード'),
 (N'仓位编码', 'zh-TW', N'倉位編碼'),             (N'仓位编码', 'ko', N'위치 코드'),
 (N'仓位编码', 'de',    N'Lagerortcode'),        (N'仓位编码', 'es', N'Código de ubicación'),
 (N'仓位编码', 'fr',    N'Code d''emplacement'), (N'仓位编码', 'ru', N'Код места хранения'),
 (N'仓位编码', 'th',    N'รหัสตำแหน่ง'),          (N'仓位编码', 'vi', N'Mã vị trí'),
 (N'默认仓位', 'en',    N'Default Bin'),         (N'默认仓位', 'ja', N'デフォルトロケーション'),
 (N'默认仓位', 'zh-TW', N'預設倉位'),             (N'默认仓位', 'ko', N'기본 저장 위치'),
 (N'默认仓位', 'de',    N'Standardlagerplatz'),  (N'默认仓位', 'es', N'Ubicación predeterminada'),
 (N'默认仓位', 'fr',    N'Emplacement par défaut'), (N'默认仓位', 'ru', N'Место хранения по умолчанию'),
 (N'默认仓位', 'th',    N'ตำแหน่งเริ่มต้น'),      (N'默认仓位', 'vi', N'Vị trí mặc định'),
 (N'是否默认', 'en',    N'Default'),             (N'是否默认', 'ja', N'デフォルト'),
 (N'是否默认', 'zh-TW', N'是否預設'),             (N'是否默认', 'ko', N'기본 여부'),
 (N'是否默认', 'de',    N'Standard'),            (N'是否默认', 'es', N'Predeterminado'),
 (N'是否默认', 'fr',    N'Par défaut'),          (N'是否默认', 'ru', N'По умолчанию'),
 (N'是否默认', 'th',    N'ค่าเริ่มต้น'),          (N'是否默认', 'vi', N'Mặc định');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', s.k, s.loc, s.txt, 'manual' FROM @tr s
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope = 'field' AND t.ref_key = s.k AND t.locale = s.loc);
PRINT N'[bin-purchase-in] ⑤ 译名补插行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ---------- ⑥ 自检 ---------- */
IF COL_LENGTH('dbo.bs_wh_loc', N'是否默认') IS NULL RAISERROR(N'bs_wh_loc.是否默认 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'WHLOC' AND col_name = N'是否默认' AND data_type = N'是否')
    RAISERROR(N'WHLOC 明细「是否默认」未登记', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND col_name = N'仓位编码'
               AND place LIKE N'%detail%' AND data_type = N'参照' AND ref_panel = N'WHLOC'
               AND ref_filter = N'仓库=$仓库' AND hidden = 0 AND visible = 1)
    RAISERROR(N'采购入库明细「仓位」未按只读参照口径登记', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND col_name = N'仓位名称' AND label = N'仓位名称')
    RAISERROR(N'旧行「仓位名称」仍在(改造未生效)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INV' AND col_name = N'默认仓位' AND hidden = 0)
    RAISERROR(N'商品档案「默认仓位」仍是隐藏', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'是否默认') < 10
    RAISERROR(N'「是否默认」译名不足 10 语言', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'仓位') < 10
    RAISERROR(N'「仓位」译名不足 10 语言', 16, 1);
-- 越界自检:四单字段总数应仍为 329(本脚本对采购入库是「改一行」,不是加一行)
DECLARE @four int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN'));
IF @four <> 329 RAISERROR(N'四单字段行数被误伤(应 329,实际 %d)', 16, 1, @four);
PRINT N'✅ 采购入库明细「仓位」启用 + 仓位默认标记 + 物料默认仓位可见 迁移完成(四单字段仍 329 行)';
