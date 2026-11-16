/* ============================================================================
   migrate-mix-batch-20261118.sql — 混料记录加「物料批次」列(扫码混料按《成型配料记录》纸面打印需要)

   用户口径(2026-11-18,给了纸样《成型配料记录》YJ-QR-147,要求横板 A4 打印):
   纸面有「物料批次」一列 —— 现场扫的物料码本身就是 `存货编码|批号`(批号就在码里),
   以前扫码只取编码、把批号丢了;这张单要印批号,必须存下来。

   做的事(幂等):
     ① wo_mixing_list 增列 [物料批次] nvarchar(60) NULL + 列中文注明;
     ② 混料记录面板(WO_MIXING_LIST)补第 20 个只读字段「物料批次」,排在「实际用量」之后
        (只读报表:可写=0/必填=0/隐藏=0/可见=1,与其它字段一致);
     ③ en/ja 译名;
     ④ 守卫:列在、字段在且只读、译名在。

   执行:DbSync(两账套;先正式、后测试)
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST,禁止在其他数据库执行。', 1;

IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NULL
    THROW 51000, N'wo_mixing_list 不存在(请先跑 migrate-wo-mixing-list-20261022.sql)。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ── ① 列 ───────────────────────────────────────────────────────────────── */
    IF COL_LENGTH(N'dbo.wo_mixing_list', N'物料批次') IS NULL
        ALTER TABLE dbo.wo_mixing_list ADD [物料批次] nvarchar(60) NULL;

    IF EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_mixing_list')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_mixing_list'), N'物料批次', 'ColumnId')
                  AND name = N'MS_Description')
        EXEC sys.sp_updateextendedproperty N'MS_Description',
            N'扫码混料时从物料码(存货编码|批号)带出的物料批次,按《成型配料记录》纸面「物料批次」列打印',
            N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list', N'COLUMN', N'物料批次';
    ELSE
        EXEC sys.sp_addextendedproperty N'MS_Description',
            N'扫码混料时从物料码(存货编码|批号)带出的物料批次,按《成型配料记录》纸面「物料批次」列打印',
            N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list', N'COLUMN', N'物料批次';

    /* ── ② 面板字段(混料记录 = 只读报表,19 → 20 个字段) ─────────────────────── */
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'WO_MIXING_LIST' AND col_name = N'物料批次')
        INSERT INTO dbo.yj_field
          (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
           display_field, place, seq, width, editable, required, hidden, visible)
        VALUES (N'WO_MIXING_LIST', N'物料批次', N'物料批次', N'Material Lot', N'文本', NULL, NULL, NULL,
                NULL, N'detail', 145, 130, 0, 0, 0, 1);

    /* ── ③ 译名 ─────────────────────────────────────────────────────────────── */
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
    SELECT 'field', N'物料批次', t.locale, t.text, 'manual'
      FROM (VALUES ('en', N'Material Lot'), ('ja', N'材料ロット')) t(locale, text)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                        WHERE x.scope = 'field' AND x.ref_key = N'物料批次' AND x.locale = t.locale);

    /* ── ④ 守卫 ─────────────────────────────────────────────────────────────── */
    IF COL_LENGTH(N'dbo.wo_mixing_list', N'物料批次') IS NULL
        THROW 51000, N'wo_mixing_list.物料批次 未建成功。', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
                    WHERE panel_code = N'WO_MIXING_LIST' AND col_name = N'物料批次'
                      AND editable = 0 AND required = 0 AND hidden = 0 AND visible = 1)
        THROW 51000, N'混料记录面板缺「物料批次」字段(或不是只读可见)。', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                    WHERE scope = 'field' AND ref_key = N'物料批次' AND locale = 'en' AND LEN(text) > 0)
        THROW 51000, N'「物料批次」en 译名缺失。', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT p.panel_code, p.panel_name,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       COL_LENGTH(N'dbo.wo_mixing_list', N'物料批次') AS 物料批次列字节
  FROM dbo.yj_panel p WHERE p.panel_code = N'WO_MIXING_LIST';
SELECT N'RESULT: MIX-BATCH-READY' AS 结果;
