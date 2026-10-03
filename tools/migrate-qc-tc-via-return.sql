/* ============================================================================
 * 特采改由「暂收退料单」发起(检验 → 退料单 → 特采单 → 采购入库)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-04 定稿):
 *   ① 下线 来料检验单 明细的「特采」勾选字段 —— 特采不再在检验环节判定;
 *   ② 「特采」改为**暂收退料单的按钮**(工具栏,明细行级:一行物料一张特采单);
 *   ③ **暂收退料单审批(审核/审批通过)之后**才允许点该按钮;
 *   ④ 暂收退料单要**记录来料检验单的「送检数量」**,后面由它填入特采单:
 *        特采单 总数量 = 送检数量(+计量单位)、不合格品数量 = 退货数量、比例自动算;
 *   ⑤ 特采单审批通过 → 采购入库单(全部数量入库,实收数量 = 特采单总数量)。
 *
 * 链路对照:
 *   旧:检验单审核 ─(勾了特采的行)→ 特采单 → 特采审核 → 采购入库单
 *   新:检验单审核 ─(不良行)→ 暂收退料单(带 送检数量/退货数量)
 *                  └ 退料单审核/审批通过 ─[特采按钮]→ 特采单 → 特采审批 → 采购入库单
 *      检验单的 合格行 → 采购入库单(与特采无关,一直如此)
 *
 * 本脚本(幂等):
 *   ① qc_return_detail 加 [送检数量] decimal(18,4) + 中文注明;
 *   ② qc_tc_in 加 [暂收退料单号] nvarchar(120)(隐藏链路列)+ 中文注明;
 *   ③ yj_field:摘掉 QC_INSP 明细「特采」;登记 QC_RETURN 明细「送检数量」(只读,随链继承);
 *      登记 QC_TC_IN 头隐藏「暂收退料单号」;
 *   ④ yj_translation 补「送检数量」「暂收退料单号」×10 语言(多语言强制规范);
 *   ⑤ 存量回填:已有暂收退料单行的「送检数量」按 form_flow_link 溯源列回检验行
 *      (链路缺失时按「头 检验单号 + 物料编码」兜底);
 *   ⑥ 自检。
 *
 * 刻意不动的东西(非破坏性):
 *   · qc_insp_detail.[特采] 列与存量 10 行为 1 的数据**保留**(历史留痕);
 *   · 旧口径已生成的 QC_INSP→QC_TC_IN ACTIVE 链路与那批特采单**保留**且仍然可审批 ——
 *     配套代码里 tcInApprovedGenerate / inspUnauditCascade **同时认** QC_RETURN→QC_TC_IN(新)
 *     与 QC_INSP→QC_TC_IN(旧)两种来源,老单不会因为换口径而卡死。
 *
 * 配套代码(同提交):ButtonService(inspAutoPurchaseIn/inspAutoReturn 取消特采排除、
 *   inspAutoReturn 行带送检数量、returnAutoSpecialAccept 特采按钮、tcInApprovedGenerate
 *   双来源解析、returnUnauditCascade/tcInUnauditCascade 弃审级联)、
 *   PanelConfigService(QC_RETURN 工具栏「特采」组)、PanelPermissionService(权限词)、
 *   PushGenerateHandler(拆掉检验行特采闸门)、前端 i18n(特采/送检数量)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 暂收退料单明细:送检数量(来料检验单送检数据的数量) ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'送检数量') IS NULL
    ALTER TABLE dbo.qc_return_detail ADD [送检数量] decimal(18,4) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'送检数量', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'送检数量:来料检验单明细的送检数量(检验单审核自动生成本退料单时随链带入,只读);特采按钮按它填特采单「总数量」',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'送检数量';
GO

/* ---------- ② 特采单:暂收退料单号(链路列,纸面 YJ-QR-60 无,隐藏) ---------- */
IF COL_LENGTH('dbo.qc_tc_in', N'暂收退料单号') IS NULL
    ALTER TABLE dbo.qc_tc_in ADD [暂收退料单号] nvarchar(120) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_tc_in')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_tc_in'), N'暂收退料单号', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'暂收退料单号:生成本特采单的暂收退料单(2026-10-04 新链路 QC_RETURN→QC_TC_IN 的来源单号;旧口径由检验单直接生成的特采单此列为空)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in', N'COLUMN', N'暂收退料单号';
GO

/* ---------- ③ yj_field 登记 ---------- */
-- ③-1 来料检验单明细「特采」下线(2026-10-04:特采判定移到暂收退料单按钮)
DELETE FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'特采';
GO
-- ③-2 暂收退料单明细「送检数量」(seq 85:紧跟在 退货数量(80) 之后、计量单位(90) 之前)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name = N'送检数量'
               AND place LIKE '%detail%')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'送检数量', N'送检数量', N'小数', NULL, NULL, NULL, NULL,
            N'detail', 85, 100, 0, 0, 0, 1);
GO
-- ③-3 特采单头「暂收退料单号」(隐藏链路列,与 检验单号 同款)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name = N'暂收退料单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_TC_IN', N'暂收退料单号', N'暂收退料单号', N'文本', NULL, NULL, NULL, NULL,
            N'header', 903, 80, 0, 0, 1, 0);
GO

/* ---------- ④ 译名 ×10 语言 ---------- */
DECLARE @tr TABLE (k NVARCHAR(50), loc NVARCHAR(5), txt NVARCHAR(200));
INSERT INTO @tr VALUES
 (N'送检数量', N'en',    N'Sent for Inspection Qty'), (N'送检数量', N'ja',    N'検査提出数量'),
 (N'送检数量', N'ko',    N'검사 제출 수량'),           (N'送检数量', N'zh-TW', N'送檢數量'),
 (N'送检数量', N'es',    N'Cant. enviada a inspección'), (N'送检数量', N'fr', N'Qté envoyée au contrôle'),
 (N'送检数量', N'de',    N'Zur Prüfung gesendete Menge'), (N'送检数量', N'ru', N'Кол-во на проверку'),
 (N'送检数量', N'vi',    N'SL gửi kiểm tra'),          (N'送检数量', N'th',    N'จำนวนส่งตรวจ'),
 (N'暂收退料单号', N'en',    N'Temporary Receipt Return No.'), (N'暂收退料单号', N'ja', N'仮受返品伝票番号'),
 (N'暂收退料单号', N'ko',    N'임시 입고 반품 번호'),   (N'暂收退料单号', N'zh-TW', N'暫收退料單號'),
 (N'暂收退料单号', N'es',    N'N.º de devolución de recepción temporal'), (N'暂收退料单号', N'fr', N'N° de retour de réception temporaire'),
 (N'暂收退料单号', N'de',    N'Nr. der vorläufigen Wareneingangsrückgabe'), (N'暂收退料单号', N'ru', N'№ возврата временного приёма'),
 (N'暂收退料单号', N'vi',    N'Số phiếu trả hàng nhận tạm'), (N'暂收退料单号', N'th', N'เลขที่ใบรับชั่วคราว-คืน');
MERGE yj_translation AS t
USING (SELECT k, loc, txt FROM @tr) AS s(k, loc, txt)
ON t.scope = 'field' AND t.ref_key = s.k AND t.locale = s.loc
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES ('field', s.k, s.loc, s.txt, 'manual');
GO

/* ---------- ⑤ 存量回填:暂收退料单行「送检数量」 ← 来料检验单行 ---------- */
-- ⑤-0 先归零再重算:本列**没有人工录入口**(yj_field editable=0),唯一写入方就是
--      「检验单审核自动生退料单」这条链与本次回填 —— 故重跑=重算,保证口径永远自洽。
--      (必要性:兜底规则收紧前跑过一次的老库,可能留下按「同料取最大」误配的值,靠这一步洗掉。)
UPDATE dbo.qc_return_detail SET [送检数量] = NULL WHERE [送检数量] IS NOT NULL;
PRINT N'[qc-tc-via-return] ⑤-0 重置待重算: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ⑤-1 首选:按链路 form_flow_link(QC_INSP→QC_RETURN 的 target_line_key = 单号#行id)精确溯源
UPDATE d SET d.[送检数量] = src.[送检数量]
FROM dbo.qc_return_detail d
JOIN dbo.form_flow_link l
  ON l.source_panel_code = 'QC_INSP' AND l.target_panel_code = 'QC_RETURN'
 AND l.target_line_key = d.单据编号 + N'#' + CAST(d.id AS nvarchar(20))
JOIN dbo.qc_insp_detail src
  ON l.source_line_key = l.source_form_no + N'#' + CAST(src.id AS nvarchar(20))
WHERE d.[送检数量] IS NULL AND src.[送检数量] IS NOT NULL;
PRINT N'[qc-tc-via-return] ⑤-1 链路溯源回填 送检数量: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ⑤-2 兜底:链路缺失的老单,按「头 检验单号 + 物料编码 + 不良数量 = 本行退货数量」找检验行,
--      **且必须唯一命中**才回填 —— 一张检验单可以有同一物料的多行(送检量各不相同),多命中时
--      取最大/最小都是编数据,宁可留空(留空由前端/生单侧按 退货数量 兜底,不阻断业务)。
UPDATE d SET d.[送检数量] = x.qty
FROM dbo.qc_return_detail d
JOIN dbo.qc_return h ON h.单据编号 = d.单据编号
CROSS APPLY (SELECT MIN(i.[送检数量]) AS qty
               FROM dbo.qc_insp_detail i
              WHERE i.单据编号 = h.检验单号 AND ISNULL(i.asp_cancel, 'N') <> 'Y'
                AND i.物料编码 = d.物料编码
                AND ABS(ISNULL(i.[不良数量], 0) - ISNULL(d.[退货数量], 0)) < 0.0001
             HAVING COUNT(*) = 1) x
WHERE d.[送检数量] IS NULL AND x.qty IS NOT NULL;
PRINT N'[qc-tc-via-return] ⑤-2 检验单号+物料编码+不良数量 唯一命中兜底回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ⑥ 自检 ---------- */
IF COL_LENGTH('dbo.qc_return_detail', N'送检数量') IS NULL RAISERROR(N'qc_return_detail.送检数量 未建', 16, 1);
IF COL_LENGTH('dbo.qc_tc_in', N'暂收退料单号') IS NULL RAISERROR(N'qc_tc_in.暂收退料单号 未建', 16, 1);
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_INSP' AND col_name = N'特采')
    RAISERROR(N'QC_INSP 明细「特采」字段行未下线', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_RETURN' AND col_name = N'送检数量'
               AND place LIKE '%detail%' AND hidden = 0 AND visible = 1)
    RAISERROR(N'QC_RETURN 明细「送检数量」未登记', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name = N'暂收退料单号'
               AND hidden = 1 AND visible = 0 AND editable = 0)
    RAISERROR(N'QC_TC_IN 隐藏链路列「暂收退料单号」未按只读登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'送检数量') < 10
    RAISERROR(N'「送检数量」译名不足 10 语言', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'暂收退料单号') < 10
    RAISERROR(N'「暂收退料单号」译名不足 10 语言', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'送检数量', 'ColumnId')
                 AND name = 'MS_Description')
    RAISERROR(N'qc_return_detail.送检数量 缺中文注明', 16, 1);
DECLARE @left INT = (SELECT COUNT(*) FROM dbo.qc_return_detail d
                     JOIN dbo.qc_return h ON h.单据编号 = d.单据编号
                     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y' AND d.[送检数量] IS NULL
                       AND EXISTS (SELECT 1 FROM dbo.qc_insp_detail i
                                    WHERE i.单据编号 = h.检验单号 AND ISNULL(i.asp_cancel, 'N') <> 'Y'
                                      AND i.[送检数量] IS NOT NULL));
PRINT N'✅ 特采改经暂收退料单 迁移完成:送检数量列/' + N'特采字段下线/链路列/字段登记/译名/存量回填';
PRINT N'   仍缺「送检数量」的退料行(检验单本身没填送检数量的历史单,留空不算错): ' + CAST(@left AS nvarchar(10)) + N' 行';
GO
