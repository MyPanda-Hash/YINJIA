/* ============================================================================
   migrate-specdoc-subitem-20261030.sql
   产品规格书「4.产品性能检验项目及检验标准」补「检验子项」列(2026-10-30)

   【怎么发现的】
     2026-10-30 用户报「产品信息表写了 BOM 保存后全是 `/`」并追加要求「还有其他的类似的问题吗?
     排查一下研发管理」。对 19 个研发文书面板做了三方比对
     (前端 recordSheetConfigs 的 dataTables cols ↔ yj_field.label ↔ 物理列),
     除已修的产品信息表 BOM 外,只剩这一处:
       frontend/src/core/views/recordSheetConfigs.js:1649
         { key: '检验子项', label: '检验子项', w: 73, align: 'center', groupSub: true }
     而 yj_field 里 RD_SPEC_DOC 的 detail 字段只有 15 个,**没有「检验子项」**,
     rd_spec_doc_detail 也没有该物理列 ⇒ 用户在这一列填的内容保存时被静默丢弃。

   【为什么 groupSub 不是理由】
     grep 全前端:`groupSub` 只在上面那一行出现,**没有任何代码消费它**
     (RecordSheetPanels.vue 零匹配)⇒ 它是设计遗留属性,不影响数据键:
     该列照样进 colKeys 参与提交,只是后端认不出列名而丢弃。

   【本脚本做什么】
     1. rd_spec_doc_detail 补 [检验子项] nvarchar(100);
     2. yj_field 补 RD_SPEC_DOC 的 detail 字段(label=col_name=检验子项,seq=75,
        插在「检验项目」(70)与「检验要求」(80)之间,与设计列序一致);
     3. yj_translation 补 10 种语言译名(AGENTS.md 多语言强制规范);
     4. 列中文注释。
     · 全部 IF NOT EXISTS 守卫,幂等可复跑;不动既有数据。

   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

/* ── 1) 物理列 ── */
IF COL_LENGTH('rd_spec_doc_detail', N'检验子项') IS NULL
    ALTER TABLE rd_spec_doc_detail ADD [检验子项] nvarchar(100) NULL;

/* ── 2) 元数据字段 ── */
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_SPEC_DOC' AND col_name=N'检验子项' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_SPEC_DOC', N'检验子项', N'检验子项', N'文本', 'detail', 75, 1, 0, 0, 1);

/* ── 3) 译名(10 种语言;一处缺译,切到英语/日语就会露出中文)── */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验子项' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
      ('field', N'检验子项', 'en',    N'Inspection sub-item',        'manual'),
      ('field', N'检验子项', 'ja',    N'検査サブ項目',               'manual'),
      ('field', N'检验子项', 'zh-TW', N'檢驗子項',                   'manual'),
      ('field', N'检验子项', 'ko',    N'검사 세부 항목',             'manual'),
      ('field', N'检验子项', 'vi',    N'Tiểu mục kiểm tra',          'manual'),
      ('field', N'检验子项', 'th',    N'รายการย่อยการตรวจสอบ',        'manual'),
      ('field', N'检验子项', 'fr',    N'Sous-élément d''inspection', 'manual'),
      ('field', N'检验子项', 'ru',    N'Подпункт проверки',          'manual'),
      ('field', N'检验子项', 'es',    N'Subelemento de inspección',  'manual'),
      ('field', N'检验子项', 'de',    N'Prüfunterelement',           'manual');

/* ── 4) 列中文注释 ── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_spec_doc_detail')
                  AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_spec_doc_detail'),N'检验子项','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'规格书检验要求表区:检验子项(与检验项目成组)',
        'SCHEMA','dbo','TABLE','rd_spec_doc_detail','COLUMN',N'检验子项';

/* ── 5) 自检:列 + 字段 + 10 种译名 ── */
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns
                     WHERE object_id=OBJECT_ID('rd_spec_doc_detail') AND name=N'检验子项');
DECLARE @fld int = (SELECT COUNT(*) FROM yj_field
                     WHERE panel_code='RD_SPEC_DOC' AND place='detail' AND col_name=N'检验子项');
DECLARE @tr  int = (SELECT COUNT(*) FROM yj_translation
                     WHERE scope='field' AND ref_key=N'检验子项');

PRINT N'[DB] ' + @db;
PRINT N'[OK] 列 ' + CAST(@col AS nvarchar(5)) + N'/1,字段 ' + CAST(@fld AS nvarchar(5))
    + N'/1,译名 ' + CAST(@tr AS nvarchar(5)) + N'/10';

IF @col <> 1 OR @fld <> 1 OR @tr < 10
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:列 %d/1、字段 %d/1、译名 %d/10,未到位,已回滚', 16, 1, @db, @col, @fld, @tr);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 规格书「检验子项」列/字段/译名齐备';
