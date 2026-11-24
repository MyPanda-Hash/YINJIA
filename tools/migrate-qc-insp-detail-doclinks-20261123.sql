/* migrate-qc-insp-detail-doclinks-20261123.sql(2026-11-23)
 *
 * 用户口径(2026-11-23,红框圈住《出货检验（表观）明细表》的「工号」列):
 *   「实现点击对应的单号可以转到对应的单据。」
 *   ⇒ 出货检验两张明细表(flat 报表)上的单号列要能点着跳:
 *       · 单据编号 → 本行所属的出货检验单(面板 QC_PROC_INSP / QC_ASM_INSP,?docNo= 定位)
 *       · 工单号   → 生产工单页(/prod/plan/workOrderList?keyword=工单号&focus=工单行id),
 *                    与「生产工序进度看板」点整行同款:定位该工单行并打开追溯。
 *
 * 为什么要有本脚本:工单页的精确锚点是 **plang.id(工单行id)**,而两张明细视图摊平的是
 * 头表字段 —— 头表只有「工单号 + 工单行号」,没有行 id。
 *   ⇒ 视图各补一列隐藏列 [工单行id] = plang.id(按 工单号+工单行号 对上,非 1:1 时取最大 id),
 *     并在 yj_field 登记 visible=0/hidden=1(不进表格列,只给前端跳转定位用)。
 *   对不上(历史作废/外部工单)时该列为 NULL ⇒ 前端退化成只按 工单号 关键字跳,不报错。
 *
 * 落地内容:
 *   A. 两个视图 CREATE OR ALTER,尾部补 [工单行id](OUTER APPLY TOP 1,不放大行数)
 *   B. yj_field 登记隐藏列(两面板各一行,label_en + 10 语言译名)
 *   C. 视图新列中文注明(MS_Description)
 *   D. 自检
 *
 * 幂等:CREATE OR ALTER VIEW / NOT EXISTS 守卫。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
PRINT N'== migrate-qc-insp-detail-doclinks-20261123 ==';
GO

/* ═════════ A1. 出货检验（功能）明细视图 ═════════ */
CREATE OR ALTER VIEW dbo.v_qc_proc_insp_detail AS
SELECT
    CAST(ROW_NUMBER() OVER (ORDER BY h.[单据日期] DESC, d.id) AS bigint) AS id,
    h.[单据日期],
    h.[单据编号],
    ISNULL(h.[工单号], N'')            AS [工单号],
    ISNULL(h.[工单行号], 0)            AS [工单行号],
    ISNULL(h.[客户名称], N'')          AS [客户名称],
    ISNULL(h.[产品编码], N'')          AS [产品编码],
    ISNULL(h.[产品名称], N'')          AS [产品名称],
    ISNULL(h.[规格型号], N'')          AS [规格型号],
    ISNULL(h.[批次号], N'')            AS [批次号],
    ISNULL(d.[内部批次], N'')          AS [内部批次],
    ISNULL(d.[检验项目], N'')          AS [检验项目],
    ISNULL(d.[检验要求], N'')          AS [检验要求],
    ISNULL(d.[检验方法], N'')          AS [检验方法],
    ISNULL(d.[实测数值], N'')          AS [实测数值],
    ISNULL(d.[结果判断], N'')          AS [结果判断],
    ISNULL(h.[检验员], N'')            AS [检验员],
    h.[检验数量],
    ISNULL(h.[总结论], N'')            AS [总结论],
    /* 隐藏列:生产工单页的定位锚(plang.id)。同号同行号历史上有重号时取最大 id 一行,
       保证本视图仍然「一行 = 一个检验项目×内部批次」,不会因为关联工单把行数放大。 */
    wo.[工单行id]
  FROM dbo.qc_proc_insp_head h
  JOIN dbo.qc_proc_insp_detail d ON d.[单据编号] = h.[单据编号]
  OUTER APPLY (
      SELECT TOP 1 p.id AS [工单行id]
        FROM dbo.plang p
       WHERE p.pl_no = h.[工单号]
         AND p.pl_xc = h.[工单行号]
         AND ISNULL(p.asp_cancel, N'N') <> N'Y'
       ORDER BY p.id DESC
  ) wo
 WHERE ISNULL(h.asp_cancel, 'N') <> 'Y' AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

/* ═════════ A2. 出货检验（表观）明细视图 ═════════
   ⚠ 表观单的录入值列:新口径在「实测数值」，历史(组装成品检验)数据在「检验结果」
     ⇒ COALESCE 两列，避免老单明细一眼全空。 */
CREATE OR ALTER VIEW dbo.v_qc_asm_insp_detail AS
SELECT
    CAST(ROW_NUMBER() OVER (ORDER BY h.[单据日期] DESC, d.id) AS bigint) AS id,
    h.[单据日期],
    h.[单据编号],
    ISNULL(h.[工单号], N'')            AS [工单号],
    ISNULL(h.[工单行号], 0)            AS [工单行号],
    ISNULL(h.[客户名称], N'')          AS [客户名称],
    ISNULL(h.[产品编码], N'')          AS [产品编码],
    ISNULL(h.[产品名称], N'')          AS [产品名称],
    ISNULL(h.[规格型号], N'')          AS [规格型号],
    ISNULL(h.[批次号], N'')            AS [批次号],
    ISNULL(d.[内部批次], N'')          AS [内部批次],
    ISNULL(d.[检验项目], N'')          AS [检验项目],
    ISNULL(d.[检验要求], N'')          AS [检验要求],
    ISNULL(d.[检验方法], N'')          AS [检验方法],
    COALESCE(NULLIF(d.[实测数值], N''), NULLIF(d.[检验结果], N''), N'') AS [实测数值],
    ISNULL(d.[结果判断], N'')          AS [结果判断],
    ISNULL(h.[检验员], N'')            AS [检验员],
    h.[检验数量],
    ISNULL(h.[总结论], N'')            AS [总结论],
    /* 隐藏列:同 A1(生产工单页的定位锚 plang.id) */
    wo.[工单行id]
  FROM dbo.qc_asm_insp_head h
  JOIN dbo.qc_asm_insp_detail d ON d.[单据编号] = h.[单据编号]
  OUTER APPLY (
      SELECT TOP 1 p.id AS [工单行id]
        FROM dbo.plang p
       WHERE p.pl_no = h.[工单号]
         AND p.pl_xc = h.[工单行号]
         AND ISNULL(p.asp_cancel, N'N') <> N'Y'
       ORDER BY p.id DESC
  ) wo
 WHERE ISNULL(h.asp_cancel, 'N') <> 'Y' AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

/* ═════════ B. 隐藏列登记(col_name 必须 = 视图物理列名;visible=0 不进表格) ═════════ */
DECLARE @f TABLE (col_name sysname, label_en nvarchar(120), data_type nvarchar(40), place varchar(60),
                  seq int, width int, visible bit, hidden bit);
INSERT INTO @f (col_name, label_en, data_type, place, seq, width, visible, hidden) VALUES
 (N'工单行id', N'Work Order Line ID', N'整数', N'detail', 910, 90, 0, 1);

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_PROC_INSP_DETAIL', f.col_name, f.col_name, f.label_en, f.data_type, NULL, NULL, NULL,
       NULL, f.place, f.seq, f.width, 0, 0, f.hidden, f.visible
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x
                    WHERE x.panel_code = N'QC_PROC_INSP_DETAIL' AND x.col_name = f.col_name);
INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_ASM_INSP_DETAIL', f.col_name, f.col_name, f.label_en, f.data_type, NULL, NULL, NULL,
       NULL, f.place, f.seq, f.width, 0, 0, f.hidden, f.visible
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x
                    WHERE x.panel_code = N'QC_ASM_INSP_DETAIL' AND x.col_name = f.col_name);
GO

/* ═════════ C. 译名(10 语言;同一中文标签全局共享)═════════ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('field', N'工单行id', 'en',    N'Work Order Line ID'),
 ('field', N'工单行id', 'zh-TW', N'工單行ID'),
 ('field', N'工单行id', 'ja',    N'作業指示行ID'),
 ('field', N'工单行id', 'ko',    N'작업지시 행 ID'),
 ('field', N'工单行id', 'es',    N'ID de línea de orden de trabajo'),
 ('field', N'工单行id', 'fr',    N'ID de ligne d''ordre de fabrication'),
 ('field', N'工单行id', 'de',    N'Arbeitsauftrag-Zeilen-ID'),
 ('field', N'工单行id', 'ru',    N'ID строки производственного заказа'),
 ('field', N'工单行id', 'vi',    N'ID dòng lệnh sản xuất'),
 ('field', N'工单行id', 'th',    N'ID แถวใบสั่งผลิต');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* ═════════ D. 新列中文注明 ═════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.v_qc_proc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.v_qc_proc_insp_detail'), N'工单行id', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'plang.id(隐藏列:工单行号对应的生产工单行,前端「点工单号→生产工单页 ?focus=」定位用;对不上为 NULL)',
        N'SCHEMA', N'dbo', N'VIEW', N'v_qc_proc_insp_detail', N'COLUMN', N'工单行id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.v_qc_asm_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.v_qc_asm_insp_detail'), N'工单行id', 'ColumnId')
                 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'plang.id(隐藏列:工单行号对应的生产工单行,前端「点工单号→生产工单页 ?focus=」定位用;对不上为 NULL)',
        N'SCHEMA', N'dbo', N'VIEW', N'v_qc_asm_insp_detail', N'COLUMN', N'工单行id';
GO

/* ═════════ E. 自检(三态:视图缺失=跳过/字段缺失=FAIL) ═════════ */
DECLARE @db sysname = DB_NAME();
DECLARE @viewOk int = 0, @fieldOk int = 0, @trOk int = 0;
IF OBJECT_ID(N'dbo.v_qc_proc_insp_detail', N'V') IS NOT NULL
   AND OBJECT_ID(N'dbo.v_qc_asm_insp_detail', N'V') IS NOT NULL
BEGIN
    SET @viewOk = 1;
    IF COL_LENGTH(N'dbo.v_qc_proc_insp_detail', N'工单行id') IS NOT NULL
       AND COL_LENGTH(N'dbo.v_qc_asm_insp_detail', N'工单行id') IS NOT NULL
        SET @viewOk = 2;
END
SELECT @fieldOk = COUNT(*) FROM yj_field
 WHERE col_name = N'工单行id' AND visible = 0 AND hidden = 1
   AND panel_code IN (N'QC_PROC_INSP_DETAIL', N'QC_ASM_INSP_DETAIL');
SELECT @trOk = COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行id';

IF @viewOk = 0
    RAISERROR(N'[SKIP] %s 两张出货检验明细视图不存在(请先执行 migrate-qc-insp-detail-panels-20261123.sql)', 10, 1, @db);
ELSE IF @viewOk = 2 AND @fieldOk = 2 AND @trOk >= 10
    RAISERROR(N'[PASS] %s 两张明细视图已补隐藏列 工单行id + 2 字段 + %d 译名', 10, 1, @db, @trOk);
ELSE
    RAISERROR(N'[FAIL] %s 视图列=%d/2, 隐藏字段=%d/2, 译名=%d/10', 16, 1, @db, @viewOk, @fieldOk, @trOk);
GO
