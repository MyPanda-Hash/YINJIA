/* ============================================================================
 * migrate-qc-pending-detail-20261111.sql
 * 一、检验目录 → 待检验目录;二、新增「检验数据记录明细表」可查询明细面板
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   ①「已经完成检验的就不用显示了,现在这个检验目录,改名成待检验目录,只需要待检验的数据。」
 *   ②「另外做一个检验数据记录的明细表面版(可以查询)。每一条罗列的都要带来料检验单,
 *      也要带行号和检验数据记录。」
 *   ③「还有也要有采购订单,送料暂收单,采购入库单(这3个的单号和行号,但是这个不用跳转,
 *      只有上面两个才用)。」
 *   ④「还有50行一页。」
 *
 * 本脚本负责「库里的那一半」(前端两处见 QcCatalogSheet.vue / PanelxList.vue):
 *   A. 面板改名:QC_CATALOG 的 panel_name 检验目录 → 待检验目录(+ en 与 10 语言译名)。
 *      **面板编码 QC_CATALOG 一个字节不动** —— 按钮分发(ButtonService 的 完成/修改/删除记录)、
 *      守卫断言、yj_role_panel 授权、菜单 path 全部按编码走,改名只动显示名。
 *      「只显示待检验的数据」= 前端纸面按 检验状态<>'已完成检验' 过滤(见 QcCatalogSheet 的 pendingRows),
 *      库与 qc_catalog_detail 仍保留全部行 —— 已完成的那些在②这张明细表里查。
 *   B. 新建视图 dbo.v_qc_insp_rec_detail:一行 = 一条检验数据记录(= 来料检验单的一行物料),
 *      把整条链的单号+行号摊平:来料检验单 / 检验数据记录 / 采购订单 / 送料暂收单 / 采购入库单。
 *   C. 登记报表面板 QC_INSP_REC_DETAIL(检验数据记录明细表):mode=flat、category=报表、
 *      line_table=视图、page_size=50(④)、date_col=单据日期。
 *   D. yj_field 逐列登记(col_name 必须是本视图的物理列名)+ 两个隐藏辅助字段
 *      (目录单号/目录行id,给「取消完成」行内动作回弹检验状态用;visible=0 故不进表格列)。
 *   E. yj_role_panel 授权:照 QC_INSP_REC 的角色集合,权限收成只读(view,query,export,print)
 *      —— 它是一张只读报表,不该出现新增/删除入口。
 *   F. 多语言:2 个面板名 + 6 个新字段标签(10 语言)。
 *   G. 中文注明:视图 + 关键列(规范要求)。
 *
 * 行号口径(用户口径②③里的「行号」):
 *   · 来料检验单行号 = 该物料行在 qc_insp_detail 里的行序(ROW_NUMBER by id,排除作废行 ——
 *     与检验单界面上的「序号」同口径);
 *   · 送料暂收单行号 = 该物料行在 sl_recv_detail 里的行序(同上);
 *   · 采购订单行号 = 直接取 qc_insp_detail.采购订单行号(生单时从暂收单继承下来的原始行号),
 *     取不到才回落到暂收单行的 采购订单行号;
 *   · 采购入库单行号 = bl_purchase_in.行号(有值就用),否则按该入库单内的行序。
 *
 * 关联口径(尽量宽,取不到就留空,绝不因链断而丢记录):
 *   检验记录 ←qc_insp_rec.来料检验单号→ 检验单头 ←暂收单号→ 暂收单行(按 物料编码,优先同批次)
 *   检验记录 ←qc_insp_rec.来料检验单号→ 检验单行(按 物料编码,优先同批次)←入库单号→ 入库单行
 *   入库单号为空时,再按 bd_purchase_in.来源单号 = 来料检验单号 兜底(2026-11-11 才补的「来源」列)。
 *
 * 幂等:视图 CREATE OR ALTER / 面板与字段 NOT EXISTS / 译名 NOT EXISTS / 授权 NOT EXISTS;
 *       改名 UPDATE 带窄条件(只匹配当前仍是「检验目录」的那一行),重跑不变。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-pending-detail-20261111 ==';

/* ═════════ A. 检验目录 → 待检验目录 ═════════ */
DECLARE @renamed int = 0;
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_CATALOG' AND panel_name = N'检验目录')
BEGIN
    UPDATE yj_panel SET panel_name = N'待检验目录', panel_name_en = N'Pending Inspections'
     WHERE panel_code = N'QC_CATALOG';
    SET @renamed = @@ROWCOUNT;
    PRINT N'[改名] QC_CATALOG 检验目录 → 待检验目录(' + CAST(@renamed AS nvarchar(10)) + N' 行)';
END
ELSE
    PRINT N'[改名] QC_CATALOG 已是待检验目录(幂等,不重复改)';

/* 面板编码必须还是 QC_CATALOG(改错就是全链断,直接中止) */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_CATALOG' AND panel_name = N'待检验目录')
    RAISERROR(N'[改名] QC_CATALOG 面板名不是「待检验目录」,已中止', 16, 1);
GO

/* ═════════ B. 检验数据记录明细表视图 ═════════
   ⚠ CREATE / ALTER VIEW 必须是本批次第一条语句 ⇒ 单独一批。 */
CREATE OR ALTER VIEW dbo.v_qc_insp_rec_detail AS
WITH insp AS (
    SELECT d.*, ROW_NUMBER() OVER (PARTITION BY d.[单据编号] ORDER BY d.id) AS 行序号
      FROM dbo.qc_insp_detail d
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
), recv AS (
    SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.[单据编号] ORDER BY s.id) AS 行序号
      FROM dbo.sl_recv_detail s
     WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
), pin AS (
    SELECT b.[id], b.[单据编号], b.[存货编码], b.[批号], b.[行号],
           ROW_NUMBER() OVER (PARTITION BY b.[单据编号] ORDER BY b.id) AS 行序号
      FROM dbo.bl_purchase_in b
     WHERE ISNULL(b.asp_cancel, 'N') <> 'Y'
)
SELECT
    ROW_NUMBER() OVER (ORDER BY r.[单据日期] DESC, r.id DESC) AS id,
    r.[单据日期],
    r.[单据编号]                       AS [检验数据记录单号],
    r.[来料检验单号],
    CAST(dd.[行序号] AS nvarchar(20))  AS [来料检验单行号],
    c.[检验状态],
    c.[是否合格],
    COALESCE(NULLIF(c.[检测物料类别], N''), inv.[所属类别]) AS [检测物料类别],
    r.[物料编码],
    r.[物料名称],
    r.[物料批次],
    r.[来料数量],
    i.[供应商],
    r.[检验日期],
    r.[检验人],
    r.[检验结论],
    COALESCE(NULLIF(i.[采购订单号], N''), NULLIF(sv.[采购单号], N''), NULLIF(sv.[订单号], N'')) AS [采购订单号],
    COALESCE(NULLIF(dd.[采购订单行号], N''), NULLIF(sv.[采购订单行号], N'')) AS [采购订单行号],
    i.[暂收单号]                       AS [送料暂收单号],
    CAST(sv.[行序号] AS nvarchar(20))  AS [送料暂收单行号],
    COALESCE(NULLIF(dd.[入库单号], N''), bi.[入库单号]) AS [采购入库单号],
    COALESCE(NULLIF(LTRIM(RTRIM(pl.[行号])), N''), CAST(pl.[行序号] AS nvarchar(20))) AS [采购入库单行号],
    c.[单据编号]                       AS [目录单号],
    c.[id]                             AS [目录行id],
    r.asp_user1, r.asp_time1, r.asp_cancel
  FROM dbo.qc_insp_rec r
  LEFT JOIN dbo.qc_insp i
         ON i.[单据编号] = r.[来料检验单号] AND ISNULL(i.asp_cancel, 'N') <> 'Y'
  /* 检验单行:同单同物料;同批次优先(一单同物料多批次时才能对到正确那行) */
  OUTER APPLY (SELECT TOP 1 x.[行序号], x.[入库单号], x.[采购订单行号]
                 FROM insp x
                WHERE x.[单据编号] = r.[来料检验单号]
                  AND x.[物料编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(x.[批次号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, x.id) dd
  /* 暂收单行:同单同物料;同批次优先 */
  OUTER APPLY (SELECT TOP 1 y.[行序号], y.[采购单号], y.[订单号], y.[采购订单行号]
                 FROM recv y
                WHERE y.[单据编号] = i.[暂收单号]
                  AND y.[物料编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(y.[批次号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, y.id) sv
  /* 入库单兜底:该检验单作为「来源单号」生成过采购入库单(2026-11-11 的「来源」列) */
  OUTER APPLY (SELECT TOP 1 b.[单据编号] AS [入库单号]
                 FROM dbo.bd_purchase_in b
                WHERE b.[来源单号] = r.[来料检验单号] AND ISNULL(b.asp_cancel, 'N') <> 'Y'
                ORDER BY b.id) bi
  /* 入库单行:同单同物料;同批次优先 */
  OUTER APPLY (SELECT TOP 1 p.[行号], p.[行序号]
                 FROM pin p
                WHERE p.[单据编号] = COALESCE(NULLIF(dd.[入库单号], N''), bi.[入库单号])
                  AND p.[存货编码] = r.[物料编码]
                ORDER BY CASE WHEN ISNULL(p.[批号], N'') = ISNULL(r.[物料批次], N'') THEN 0 ELSE 1 END, p.id) pl
  /* 检验目录行:检验状态/是否合格/检测物料类别(已完成的行只在这里看得到)
     ⚠ 2026-11-11 修:原先同时要求 `z.物料编码 = r.物料编码`,而早期目录行的物料编码是空的
     (migrate-qc-catalog.sql 播的那批只写了物料名称),NULL 一比对不上 ⇒ 那些行在明细表里
     「检验状态」是空的,被默认闸门(只看已完成检验)挡掉,用户看到"已完成 3 条、明细表只有 2 条"。
     现在只按 检验数据记录单号 关联,物料编码只作**优先级**(同批次号优先),不再当硬条件。 */
  OUTER APPLY (SELECT TOP 1 z.[id], z.[单据编号], z.[检验状态], z.[是否合格], z.[检测物料类别]
                 FROM dbo.qc_catalog_detail z
                WHERE z.[检验数据记录单号] = r.[单据编号]
                  AND ISNULL(z.asp_cancel, 'N') <> 'Y'
                ORDER BY CASE WHEN ISNULL(z.[物料编码], N'') = ISNULL(r.[物料编码], N'') THEN 0 ELSE 1 END, z.id DESC) c
  /* 检测物料类别兜底:商品档案所属类别 */
  OUTER APPLY (SELECT TOP 1 v.[所属类别] FROM dbo.bs_inv v WHERE v.[存货编码] = r.[物料编码] ORDER BY v.id) inv
 WHERE ISNULL(r.asp_cancel, 'N') <> 'Y';
GO

/* ═════════ C. 面板登记(flat 只读报表,50 行一页) ═════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
VALUES (N'QC_INSP_REC_DETAIL', N'检验数据记录明细表', N'报表', N'flat', N'v_qc_insp_rec_detail', NULL, NULL, N'id',
        NULL, NULL, N'单据日期', 50, N'items', N'品质管理', N'Inspection Record Details');

/* 幂等收口:页大小/日期列/所属模块(重跑也保证是 50 行一页) */
UPDATE yj_panel
   SET page_size = 50, date_col = N'单据日期', module_group = N'品质管理', category = N'报表', mode = N'flat',
       line_table = N'v_qc_insp_rec_detail', panel_name_en = N'Inspection Record Details'
 WHERE panel_code = N'QC_INSP_REC_DETAIL'
   AND (ISNULL(page_size, 0) <> 50 OR ISNULL(date_col, N'') <> N'单据日期' OR ISNULL(module_group, N'') <> N'品质管理');
GO

/* ═════════ D. 字段登记 ═════════
   col_name 必须 = 视图物理列名(QueryService 生成 t.[col_name] AS [label]);
   本面板一律 label = col_name(与检验目录同口径,前端中文列名即数据键)。 */
DECLARE @f TABLE (col_name sysname, data_type nvarchar(40), place varchar(60), seq int, width int,
                  visible bit, hidden bit);
INSERT INTO @f (col_name, data_type, place, seq, width, visible, hidden) VALUES
 (N'单据日期',         N'日期', N'query,detail',  10, 110, 1, 0),
 (N'检验数据记录单号', N'文本', N'query,detail',  20, 170, 1, 0),
 (N'来料检验单号',     N'文本', N'query,detail',  30, 160, 1, 0),
 (N'来料检验单行号',   N'文本', N'detail',        40,  95, 1, 0),
 (N'检验状态',         N'文本', N'query,detail',  50, 110, 1, 0),
 (N'是否合格',         N'文本', N'query,detail',  60,  90, 1, 0),
 (N'检测物料类别',     N'文本', N'query,detail',  70, 130, 1, 0),
 (N'物料编码',         N'文本', N'query,detail',  80, 140, 1, 0),
 (N'物料名称',         N'文本', N'query,detail',  90, 200, 1, 0),
 (N'物料批次',         N'文本', N'query,detail', 100, 130, 1, 0),
 (N'来料数量',         N'文本', N'detail',       110, 100, 1, 0),
 (N'供应商',           N'文本', N'query,detail', 120, 180, 1, 0),
 (N'检验日期',         N'日期', N'query,detail', 130, 110, 1, 0),
 (N'检验人',           N'文本', N'detail',       140, 100, 1, 0),
 (N'检验结论',         N'文本', N'detail',       150, 160, 1, 0),
 (N'采购订单号',       N'文本', N'query,detail', 160, 160, 1, 0),
 (N'采购订单行号',     N'文本', N'detail',       170, 100, 1, 0),
 (N'送料暂收单号',     N'文本', N'query,detail', 180, 160, 1, 0),
 (N'送料暂收单行号',   N'文本', N'detail',       190, 100, 1, 0),
 (N'采购入库单号',     N'文本', N'query,detail', 200, 160, 1, 0),
 (N'采购入库单行号',   N'文本', N'detail',       210, 100, 1, 0),
 /* 隐藏辅助列:不进表格(visible=0),但后端照常 SELECT 下发 —— 行内「取消完成」要把目录行 id 带回 QC_CATALOG */
 (N'目录单号',         N'文本', N'detail',       900, 160, 0, 1),
 (N'目录行id',         N'整数', N'detail',       910,  80, 0, 1);

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT N'QC_INSP_REC_DETAIL', f.col_name, f.col_name,
       CASE f.col_name
         WHEN N'来料检验单行号'   THEN N'Incoming Inspection Line'
         WHEN N'送料暂收单号'     THEN N'Receiving Note No.'
         WHEN N'送料暂收单行号'   THEN N'Receiving Note Line'
         WHEN N'采购入库单行号'   THEN N'Purchase Receipt Line'
         WHEN N'目录单号'         THEN N'Catalog No.'
         WHEN N'目录行id'         THEN N'Catalog Row ID'
         ELSE NULL END,
       f.data_type, NULL, NULL, NULL, NULL,
       f.place, f.seq, f.width, 0, 0, f.hidden, f.visible
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'QC_INSP_REC_DETAIL' AND x.col_name = f.col_name);
GO

/* ═════════ E. 授权(照 QC_INSP_REC 的角色集合,权限=只读) ═════════ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, N'QC_INSP_REC_DETAIL', N'N', N'view,query,export,print'
  FROM yj_role_panel r
 WHERE r.panel_code = N'QC_INSP_REC'
   AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.panel_code = N'QC_INSP_REC_DETAIL' AND x.role_id = r.role_id);
PRINT N'[授权] QC_INSP_REC_DETAIL 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(只读)';
GO

/* ═════════ F. 多语言 ═════════ */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('panel', N'待检验目录', 'en', N'Pending Inspections'), ('panel', N'待检验目录', 'zh-TW', N'待檢驗目錄'),
 ('panel', N'待检验目录', 'ja', N'検査待ち台帳'), ('panel', N'待检验目录', 'ko', N'검사 대기 대장'),
 ('panel', N'待检验目录', 'es', N'Inspecciones pendientes'), ('panel', N'待检验目录', 'fr', N'Inspections en attente'),
 ('panel', N'待检验目录', 'de', N'Offene Prüfungen'), ('panel', N'待检验目录', 'ru', N'Ожидают проверки'),
 ('panel', N'待检验目录', 'vi', N'Danh mục chờ kiểm tra'), ('panel', N'待检验目录', 'th', N'รายการรอตรวจสอบ'),
 ('panel', N'检验数据记录明细表', 'en', N'Inspection Record Details'), ('panel', N'检验数据记录明细表', 'zh-TW', N'檢驗資料記錄明細表'),
 ('panel', N'检验数据记录明细表', 'ja', N'検査データ記録明細表'), ('panel', N'检验数据记录明细表', 'ko', N'검사 데이터 기록 명세서'),
 ('panel', N'检验数据记录明细表', 'es', N'Detalle de registros de inspección'), ('panel', N'检验数据记录明细表', 'fr', N'Détail des enregistrements d''inspection'),
 ('panel', N'检验数据记录明细表', 'de', N'Prüfdatensatz-Details'), ('panel', N'检验数据记录明细表', 'ru', N'Детализация записей контроля'),
 ('panel', N'检验数据记录明细表', 'vi', N'Chi tiết hồ sơ kiểm tra'), ('panel', N'检验数据记录明细表', 'th', N'รายละเอียดบันทึกข้อมูลการตรวจสอบ'),
 -- 本面板新增的字段标签(其余标签全局已有译名,不重复插)
 ('field', N'来料检验单行号', 'en', N'Incoming Inspection Line'), ('field', N'来料检验单行号', 'zh-TW', N'來料檢驗單行號'),
 ('field', N'来料检验单行号', 'ja', N'受入検査書行番号'), ('field', N'来料检验单行号', 'ko', N'수입 검사서 행 번호'),
 ('field', N'来料检验单行号', 'es', N'Línea de inspección de entrada'), ('field', N'来料检验单行号', 'fr', N'Ligne de contrôle réception'),
 ('field', N'来料检验单行号', 'de', N'Eingangsprüfung Zeile'), ('field', N'来料检验单行号', 'ru', N'Строка входного контроля'),
 ('field', N'来料检验单行号', 'vi', N'Dòng phiếu kiểm tra nhập'), ('field', N'来料检验单行号', 'th', N'บรรทัดใบตรวจรับ'),
 ('field', N'送料暂收单号', 'en', N'Receiving Note No.'), ('field', N'送料暂收单号', 'zh-TW', N'送料暫收單號'),
 ('field', N'送料暂收单号', 'ja', N'受入仮受書番号'), ('field', N'送料暂收单号', 'ko', N'입고 임시접수 번호'),
 ('field', N'送料暂收单号', 'es', N'N.º de recepción provisional'), ('field', N'送料暂收单号', 'fr', N'N° de réception provisoire'),
 ('field', N'送料暂收单号', 'de', N'Eingangsbeleg Nr.'), ('field', N'送料暂收单号', 'ru', N'Номер приёмки'),
 ('field', N'送料暂收单号', 'vi', N'Số phiếu nhận tạm'), ('field', N'送料暂收单号', 'th', N'เลขที่ใบรับของชั่วคราว'),
 ('field', N'送料暂收单行号', 'en', N'Receiving Note Line'), ('field', N'送料暂收单行号', 'zh-TW', N'送料暫收單行號'),
 ('field', N'送料暂收单行号', 'ja', N'受入仮受書行番号'), ('field', N'送料暂收单行号', 'ko', N'입고 임시접수 행 번호'),
 ('field', N'送料暂收单行号', 'es', N'Línea de recepción provisional'), ('field', N'送料暂收单行号', 'fr', N'Ligne de réception provisoire'),
 ('field', N'送料暂收单行号', 'de', N'Eingangsbeleg Zeile'), ('field', N'送料暂收单行号', 'ru', N'Строка приёмки'),
 ('field', N'送料暂收单行号', 'vi', N'Dòng phiếu nhận tạm'), ('field', N'送料暂收单行号', 'th', N'บรรทัดใบรับของชั่วคราว'),
 ('field', N'采购入库单行号', 'en', N'Purchase Receipt Line'), ('field', N'采购入库单行号', 'zh-TW', N'採購入庫單行號'),
 ('field', N'采购入库单行号', 'ja', N'入庫伝票行番号'), ('field', N'采购入库单行号', 'ko', N'구매 입고서 행 번호'),
 ('field', N'采购入库单行号', 'es', N'Línea de entrada de compra'), ('field', N'采购入库单行号', 'fr', N'Ligne de réception achat'),
 ('field', N'采购入库单行号', 'de', N'Eingangsrechnung Zeile'), ('field', N'采购入库单行号', 'ru', N'Строка приходного ордера'),
 ('field', N'采购入库单行号', 'vi', N'Dòng phiếu nhập mua'), ('field', N'采购入库单行号', 'th', N'บรรทัดใบรับซื้อ'),
 ('field', N'目录单号', 'en', N'Catalog No.'), ('field', N'目录单号', 'zh-TW', N'目錄單號'),
 ('field', N'目录单号', 'ja', N'台帳番号'), ('field', N'目录单号', 'ko', N'대장 번호'),
 ('field', N'目录单号', 'es', N'N.º de catálogo'), ('field', N'目录单号', 'fr', N'N° de catalogue'),
 ('field', N'目录单号', 'de', N'Katalog Nr.'), ('field', N'目录单号', 'ru', N'Номер каталога'),
 ('field', N'目录单号', 'vi', N'Số danh mục'), ('field', N'目录单号', 'th', N'เลขที่แคตตาล็อก'),
 ('field', N'目录行id', 'en', N'Catalog Row ID'), ('field', N'目录行id', 'zh-TW', N'目錄行ID'),
 ('field', N'目录行id', 'ja', N'台帳行ID'), ('field', N'目录行id', 'ko', N'대장 행 ID'),
 ('field', N'目录行id', 'es', N'ID de fila del catálogo'), ('field', N'目录行id', 'fr', N'ID de ligne du catalogue'),
 ('field', N'目录行id', 'de', N'Katalogzeilen-ID'), ('field', N'目录行id', 'ru', N'ID строки каталога'),
 ('field', N'目录行id', 'vi', N'ID dòng danh mục'), ('field', N'目录行id', 'th', N'ID แถวแคตตาล็อก');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);

/* 面板名的 en 也同步到 yj_panel.panel_name_en(编辑页/接口按它下发译名) */
UPDATE yj_panel SET panel_name_en = N'Pending Inspections'
 WHERE panel_code = N'QC_CATALOG' AND ISNULL(panel_name_en, N'') <> N'Pending Inspections';
GO

/* ═════════ G. 中文注明(视图 + 关键列) ═════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'检验数据记录明细表只读视图(一行=一条检验数据记录=来料检验单的一行物料;把 来料检验单/检验数据记录/采购订单/送料暂收单/采购入库单 的单号+行号摊平,供 QC_INSP_REC_DETAIL 查询面板取数;不改任何业务表)',
    N'SCHEMA', N'dbo', N'VIEW', N'v_qc_insp_rec_detail';
GO

DECLARE @cols TABLE (col sysname, note nvarchar(400));
INSERT INTO @cols (col, note) VALUES
 (N'检验数据记录单号', N'qc_insp_rec.单据编号(JYSJ-…):本面板一行对应一条检验数据记录,点它跳到检验数据记录面板'),
 (N'来料检验单号',     N'qc_insp_rec.来料检验单号(IJ-…):点它跳到来料检验单面板'),
 (N'来料检验单行号',   N'该物料行在 qc_insp_detail 内的行序(按 id,排除作废行;与检验单界面序号同口径)'),
 (N'检验状态',         N'qc_catalog_detail.检验状态(正在检验中/已完成检验):已完成的行只在待检验目录里不显示,本表可查'),
 (N'是否合格',         N'qc_catalog_detail.是否合格(合格/不合格):「完成检验」时判定'),
 (N'检测物料类别',     N'qc_catalog_detail.检测物料类别,为空回落 bs_inv.所属类别'),
 (N'采购订单号',       N'qc_insp.采购订单号,为空回落暂收单行的 采购单号/订单号'),
 (N'采购订单行号',     N'qc_insp_detail.采购订单行号(生单时从暂收单继承),为空回落暂收单行的同名列'),
 (N'送料暂收单号',     N'qc_insp.暂收单号(SL-…)'),
 (N'送料暂收单行号',   N'该物料行在 sl_recv_detail 内的行序(按 id,排除作废行)'),
 (N'采购入库单号',     N'qc_insp_detail.入库单号(PI-…);为空时按 bd_purchase_in.来源单号=来料检验单号 兜底'),
 (N'采购入库单行号',   N'bl_purchase_in.行号(有值优先),否则该入库单内按 id 的行序'),
 (N'目录单号',         N'qc_catalog_detail.单据编号(隐藏列:行内「取消完成」回弹检验状态时回传给 QC_CATALOG)'),
 (N'目录行id',         N'qc_catalog_detail.id(隐藏列:同上,作 QC_CATALOG「修改」按钮的行 id)');
DECLARE @c sysname, @n nvarchar(400);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT col, note FROM @cols;
OPEN curc FETCH NEXT FROM curc INTO @c, @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                  WHERE major_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail')
                    AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.v_qc_insp_rec_detail'), @c, 'ColumnId')
                    AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n, N'SCHEMA', N'dbo', N'VIEW', N'v_qc_insp_rec_detail', N'COLUMN', @c;
  FETCH NEXT FROM curc INTO @c, @n;
END
CLOSE curc DEALLOCATE curc;
GO

/* ═════════ H. 自检 ═════════ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.v_qc_insp_rec_detail', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_CATALOG' AND panel_name = N'待检验目录') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'QC_INSP_REC_DETAIL' AND page_size = 50 AND mode = N'flat') <> 1 SET @bad = @bad + 1;
/* 视图每一列(除 id/asp_*)都要在 yj_field 登记,否则列表少列 */
IF EXISTS (SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail')
            AND c.name NOT IN (N'id', N'asp_user1', N'asp_time1', N'asp_cancel')
            AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = N'QC_INSP_REC_DETAIL' AND f.col_name = c.name))
  SET @bad = @bad + 1;
/* 反过来:登记的字段必须真实存在于视图(否则一打开就报「列名无效」) */
IF EXISTS (SELECT f.col_name FROM yj_field f WHERE f.panel_code = N'QC_INSP_REC_DETAIL'
            AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail') AND c.name = f.col_name))
  SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_INSP_REC_DETAIL') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'panel' AND ref_key = N'待检验目录' AND locale = N'en') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'panel' AND ref_key = N'检验数据记录明细表' AND locale = N'en') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.v_qc_insp_rec_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'待检验目录/检验数据记录明细表迁移自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 待检验目录(改名) + 检验数据记录明细表 QC_INSP_REC_DETAIL 就绪(视图 + 面板 + 字段 + 授权 + 10 语言 + 注明)';
GO

SELECT (SELECT COUNT(*) FROM v_qc_insp_rec_detail) AS 明细行数,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_INSP_REC_DETAIL') AS 字段数,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_INSP_REC_DETAIL') AS 授权角色数,
       (SELECT panel_name FROM yj_panel WHERE panel_code = N'QC_CATALOG') AS 目录面板名;
GO
