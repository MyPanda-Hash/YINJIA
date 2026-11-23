/* migrate-qc-insp-detail-panels-20261123.sql(2026-11-23)
 *
 * 用户口径:「增加当前出货检验两个表的明细表，实现方式参考检验数据记录明细表。」
 *   ⇒ 给 出货检验（功能）QC_PROC_INSP / 出货检验（表观）QC_ASM_INSP 各做一张**只读明细报表**:
 *     一行 = 一个检验项目 × 一个内部批次(= qc_*_insp_detail 的一行)，头表信息摊平到每行，
 *     可查询 / 导出 / 打印；实现照 QC_INSP_REC_DETAIL(检验数据记录明细表) 的 flat 模式。
 *
 * 落地内容:
 *   A. 两个视图 dbo.v_qc_proc_insp_detail / dbo.v_qc_asm_insp_detail
 *   B. 两个 flat 面板 QC_PROC_INSP_DETAIL / QC_ASM_INSP_DETAIL(报表, page_size=100, date_col=单据日期)
 *   C. yj_field 逐列登记(col_name = 视图物理列名；label = col_name)
 *   D. yj_role_panel 授权:照源面板角色集合，权限只读(view,query,export,print)
 *   E. 面板名 + 新字段标签多语言(10 语言；已有译名的标签不重复插)
 *   F. 视图/关键列中文注明
 *
 * 幂等:视图 CREATE OR ALTER / 面板与字段 NOT EXISTS / 译名 NOT EXISTS / 授权 NOT EXISTS。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
PRINT N'== migrate-qc-insp-detail-panels-20261123 ==';
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
    ISNULL(h.[总结论], N'')            AS [总结论]
  FROM dbo.qc_proc_insp_head h
  JOIN dbo.qc_proc_insp_detail d ON d.[单据编号] = h.[单据编号]
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
    ISNULL(h.[总结论], N'')            AS [总结论]
  FROM dbo.qc_asm_insp_head h
  JOIN dbo.qc_asm_insp_detail d ON d.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel, 'N') <> 'Y' AND ISNULL(d.asp_cancel, 'N') <> 'Y';
GO

/* ═════════ A3. 视图中文注明 ═════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.v_qc_proc_insp_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'出货检验（功能）明细表:一行 = 一个检验项目×内部批次(qc_proc_insp_detail)，头表信息摊平；只读报表，供查询/导出/打印(2026-11-23)',
        N'SCHEMA', N'dbo', N'VIEW', N'v_qc_proc_insp_detail';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.v_qc_asm_insp_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'出货检验（表观）明细表:一行 = 一个检验项目×内部批次(qc_asm_insp_detail)，头表信息摊平；只读报表，供查询/导出/打印(2026-11-23)',
        N'SCHEMA', N'dbo', N'VIEW', N'v_qc_asm_insp_detail';
GO

/* ═════════ B. 面板登记(flat 报表) ═════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
VALUES (N'QC_PROC_INSP_DETAIL', N'出货检验（功能）明细表', N'报表', N'flat', N'v_qc_proc_insp_detail', NULL, NULL, N'id',
        NULL, NULL, N'单据日期', 100, N'items', N'品质管理', N'Outgoing Inspection (Function) Details');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
VALUES (N'QC_ASM_INSP_DETAIL', N'出货检验（表观）明细表', N'报表', N'flat', N'v_qc_asm_insp_detail', NULL, NULL, N'id',
        NULL, NULL, N'单据日期', 100, N'items', N'品质管理', N'Outgoing Inspection (Appearance) Details');

/* 幂等收口:页大小/日期列/所属模块/名 */
UPDATE yj_panel
   SET page_size = 100, date_col = N'单据日期', module_group = N'品质管理', category = N'报表', mode = N'flat',
       line_table = N'v_qc_proc_insp_detail', panel_name = N'出货检验（功能）明细表',
       panel_name_en = N'Outgoing Inspection (Function) Details'
 WHERE panel_code = N'QC_PROC_INSP_DETAIL'
   AND (ISNULL(page_size, 0) <> 100 OR ISNULL(date_col, N'') <> N'单据日期'
        OR ISNULL(module_group, N'') <> N'品质管理' OR ISNULL(line_table, N'') <> N'v_qc_proc_insp_detail');
UPDATE yj_panel
   SET page_size = 100, date_col = N'单据日期', module_group = N'品质管理', category = N'报表', mode = N'flat',
       line_table = N'v_qc_asm_insp_detail', panel_name = N'出货检验（表观）明细表',
       panel_name_en = N'Outgoing Inspection (Appearance) Details'
 WHERE panel_code = N'QC_ASM_INSP_DETAIL'
   AND (ISNULL(page_size, 0) <> 100 OR ISNULL(date_col, N'') <> N'单据日期'
        OR ISNULL(module_group, N'') <> N'品质管理' OR ISNULL(line_table, N'') <> N'v_qc_asm_insp_detail');
GO

/* ═════════ C. 字段登记(col_name 必须 = 视图物理列名) ═════════ */
DECLARE @f TABLE (col_name sysname, data_type nvarchar(40), place varchar(60), seq int, width int);
INSERT INTO @f (col_name, data_type, place, seq, width) VALUES
 (N'单据日期',   N'日期', N'query,detail',  10, 110),
 (N'单据编号',   N'文本', N'query,detail',  20, 160),
 (N'工单号',     N'文本', N'query,detail',  30, 150),
 (N'工单行号',   N'整数', N'detail',        40,  85),
 (N'客户名称',   N'文本', N'query,detail',  50, 200),
 (N'产品编码',   N'文本', N'query,detail',  60, 130),
 (N'产品名称',   N'文本', N'query,detail',  70, 200),
 (N'规格型号',   N'文本', N'detail',        80, 160),
 (N'批次号',     N'文本', N'query,detail',  90, 120),
 (N'内部批次',   N'文本', N'query,detail', 100, 120),
 (N'检验项目',   N'文本', N'query,detail', 110, 200),
 (N'检验要求',   N'文本', N'detail',       120, 260),
 (N'检验方法',   N'文本', N'detail',       130, 260),
 (N'实测数值',   N'文本', N'detail',       140, 160),
 (N'结果判断',   N'文本', N'query,detail', 150, 110),
 (N'检验员',     N'文本', N'query,detail', 160, 110),
 (N'检验数量',   N'小数', N'detail',       170, 100),
 (N'总结论',     N'文本', N'query,detail', 180, 110);

INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_PROC_INSP_DETAIL', f.col_name, f.col_name, f.data_type, f.place, f.seq, f.width, 0, 0, 0, 1
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'QC_PROC_INSP_DETAIL' AND x.col_name = f.col_name);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_ASM_INSP_DETAIL', f.col_name, f.col_name, f.data_type, f.place, f.seq, f.width, 0, 0, 0, 1
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'QC_ASM_INSP_DETAIL' AND x.col_name = f.col_name);
GO

/* ═════════ D. 授权(照源面板角色集合,权限=只读) ═════════ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, N'QC_PROC_INSP_DETAIL', N'N', N'view,query,export,print'
  FROM yj_role_panel r
 WHERE r.panel_code = N'QC_PROC_INSP'
   AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.panel_code = N'QC_PROC_INSP_DETAIL' AND x.role_id = r.role_id);
PRINT N'[授权] QC_PROC_INSP_DETAIL 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(只读)';
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, N'QC_ASM_INSP_DETAIL', N'N', N'view,query,export,print'
  FROM yj_role_panel r
 WHERE r.panel_code = N'QC_ASM_INSP'
   AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.panel_code = N'QC_ASM_INSP_DETAIL' AND x.role_id = r.role_id);
PRINT N'[授权] QC_ASM_INSP_DETAIL 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(只读)';
GO

/* ═════════ E. 多语言(面板名 + 本批新字段标签) ═════════
   ⚠ 已有全局译名的字段(单据日期/单据编号/工单号/客户名称/产品编码/产品名称/规格型号/批次号/
     内部批次/检验项目/检验要求/检验方法/实测数值/结果判断/检验员/检验数量/总结论)不重复插。 */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('panel', N'出货检验（功能）明细表', 'en', N'Outgoing Inspection (Function) Details'),
 ('panel', N'出货检验（功能）明细表', 'zh-TW', N'出貨檢驗（功能）明細表'),
 ('panel', N'出货检验（功能）明细表', 'ja', N'出荷検査（機能）明細表'),
 ('panel', N'出货检验（功能）明细表', 'ko', N'출하 검사(기능) 명세서'),
 ('panel', N'出货检验（功能）明细表', 'es', N'Detalle de inspección de salida (función)'),
 ('panel', N'出货检验（功能）明细表', 'fr', N'Détail du contrôle de sortie (fonction)'),
 ('panel', N'出货检验（功能）明细表', 'de', N'Ausgangsprüfung (Funktion) Details'),
 ('panel', N'出货检验（功能）明细表', 'ru', N'Детализация выходного контроля (функция)'),
 ('panel', N'出货检验（功能）明细表', 'vi', N'Chi tiết kiểm tra xuất hàng (chức năng)'),
 ('panel', N'出货检验（功能）明细表', 'th', N'รายละเอียดการตรวจสอบขาออก (ฟังก์ชัน)'),
 ('panel', N'出货检验（表观）明细表', 'en', N'Outgoing Inspection (Appearance) Details'),
 ('panel', N'出货检验（表观）明细表', 'zh-TW', N'出貨檢驗（表觀）明細表'),
 ('panel', N'出货检验（表观）明细表', 'ja', N'出荷検査（外観）明細表'),
 ('panel', N'出货检验（表观）明细表', 'ko', N'출하 검사(외관) 명세서'),
 ('panel', N'出货检验（表观）明细表', 'es', N'Detalle de inspección de salida (apariencia)'),
 ('panel', N'出货检验（表观）明细表', 'fr', N'Détail du contrôle de sortie (aspect)'),
 ('panel', N'出货检验（表观）明细表', 'de', N'Ausgangsprüfung (Aussehen) Details'),
 ('panel', N'出货检验（表观）明细表', 'ru', N'Детализация выходного контроля (внешний вид)'),
 ('panel', N'出货检验（表观）明细表', 'vi', N'Chi tiết kiểm tra xuất hàng (ngoại quan)'),
 ('panel', N'出货检验（表观）明细表', 'th', N'รายละเอียดการตรวจสอบขาออก (ลักษณะภายนอก)');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* ═════════ F. 自检 ═════════ */
DECLARE @db sysname = DB_NAME();
IF OBJECT_ID(N'dbo.v_qc_proc_insp_detail', N'V') IS NOT NULL
   AND OBJECT_ID(N'dbo.v_qc_asm_insp_detail', N'V') IS NOT NULL
   AND (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN (N'QC_PROC_INSP_DETAIL', N'QC_ASM_INSP_DETAIL')
        AND mode = N'flat' AND page_size = 100) = 2
   AND (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_PROC_INSP_DETAIL') >= 18
   AND (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP_DETAIL') >= 18
   AND (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_PROC_INSP_DETAIL') > 0
   AND (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_ASM_INSP_DETAIL') > 0
   AND (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel'
        AND ref_key IN (N'出货检验（功能）明细表', N'出货检验（表观）明细表') AND locale = 'en') = 2
    RAISERROR(N'[PASS] %s 出货检验两张明细表已就绪(2 视图 + 2 面板 + 字段/授权/译名)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 出货检验两张明细表自检未通过', 16, 1, @db);
GO
