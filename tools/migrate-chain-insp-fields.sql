/* ============================================================================
 * 采购链字段流转修复 ②:检验单「暂收单号」+ 采购入库行「是否来料检验」
 * ----------------------------------------------------------------------------
 * 用户口径(2026-09-21):
 *   ①「来料检验的暂收单号是没有流转下来」——检验单表头有专门的「暂收单号」字段(参照 QC_RECV),
 *     但生单映射只盲写「来源单号」(qc_insp 表**根本没有这一列**)→ 实测 0/22 有值。
 *   ②「采购入库要根据订单是否有通过检验单判断生成的来料检验」——采购入库行的「是否来料检验」
 *     要按**来源单据**自动判定:经检验单(QC_INSP)生成=是;采购订单免检直达(PU_ORDER)=否。
 *     实测 bl_purchase_in:否 119 / 是 4 / 空 26。
 *
 * 本脚本(幂等)做存量回填与元数据补齐:
 *   ① qc_insp.暂收单号 ← 链路台账 form_flow_link 的暂收单号;再按「同采购订单号 + 同批次号」兜底;
 *   ② bl_purchase_in.是否来料检验 ← 按链路来源判定(仅填空值);
 *   ③ 该字段是「下拉框」却没有选项 → 补 dict_sql(是/否);
 *   ④ 自检:两列残留空值计数 + 字段选项就位。
 * 配套代码(同提交):
 *   · PanelConfigService.FLOW_HEAD_SYNONYMS:QC_RECV|QC_INSP 增 {单号 → 暂收单号}(选单/推式路径);
 *   · ButtonService.syncInspFromSlRecv:镜像同步头增 t.暂收单号 = s.单据编号(保存路径);
 *   · ButtonService.inspAutoPurchaseIn:自动生单行写 是否来料检验 = 是;
 *   · PushGenerateHandler.applyInspectionFlag:采购订单免检直达写 否、检验单来源写 是(推式/分批两条路)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 检验单头:暂收单号回填 ---------- */
UPDATE i
   SET i.[暂收单号] = l.source_form_no
  FROM qc_insp i
  JOIN (SELECT DISTINCT target_form_no, source_form_no FROM form_flow_link
         WHERE source_panel_code = 'QC_RECV' AND target_panel_code = 'QC_INSP') l
    ON l.target_form_no = i.[单据编号]
 WHERE ISNULL(i.[暂收单号], N'') = N'';
PRINT N'暂收单号回填(链路台账): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 兜底:无链路台账的老数据 → 同采购订单号 + 同批次号 的暂收单 */
UPDATE i
   SET i.[暂收单号] = r.[单据编号]
  FROM qc_insp i
  JOIN sl_recv r
    ON r.[采购订单号] = i.[采购订单号]
   AND ISNULL(r.[批次号], N'') = ISNULL(i.[批次号], N'')
   AND ISNULL(r.asp_cancel, 'N') <> 'Y'
 WHERE ISNULL(i.[暂收单号], N'') = N'' AND ISNULL(i.[采购订单号], N'') <> N'';
PRINT N'暂收单号回填(同订单+批次兜底): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ② 采购入库行:是否来料检验(按链路来源判定) ---------- */
UPDATE p
   SET p.[是否来料检验] = CASE WHEN l.source_panel_code = 'QC_INSP' THEN N'是' ELSE N'否' END
  FROM bl_purchase_in p
  JOIN (SELECT DISTINCT target_form_no, source_panel_code FROM form_flow_link
         WHERE target_panel_code = 'PURCHASE_IN' AND link_status = 'ACTIVE') l
    ON l.target_form_no = p.[单据编号]
 WHERE ISNULL(p.[是否来料检验], N'') = N'';
PRINT N'是否来料检验回填(按链路来源): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* 兜底(用户口径的另一种表述:"根据订单是否有通过检验单判断"):无链路台账的历史入库单,
   看该入库单对应的**采购订单**在库里有没有来料检验单 → 有=是,没有=否(免检直达) */
UPDATE p
   SET p.[是否来料检验] = CASE WHEN EXISTS (
         SELECT 1 FROM qc_insp i
          WHERE ISNULL(i.[采购订单号], N'') <> N''
            AND i.[采购订单号] = h.[采购订单号]
            AND ISNULL(i.asp_cancel, 'N') <> 'Y') THEN N'是' ELSE N'否' END
  FROM bl_purchase_in p
  JOIN bd_purchase_in h ON h.[单据编号] = p.[单据编号]
 WHERE ISNULL(p.[是否来料检验], N'') = N'';
PRINT N'是否来料检验回填(按订单有无检验单兜底): ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ③ 下拉选项(该字段是「下拉框」但 dict_sql 为空 → 界面无选项) ---------- */
UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)'
 WHERE panel_code = 'PURCHASE_IN' AND label = N'是否来料检验'
   AND (dict_sql IS NULL OR LTRIM(RTRIM(dict_sql)) = N'');
PRINT N'是否来料检验 下拉选项补齐: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ④ 自检 ---------- */
DECLARE @inspLeft INT = (SELECT COUNT(*) FROM qc_insp WHERE ISNULL([暂收单号], N'') = N'');
DECLARE @pinLeft INT = (SELECT COUNT(*) FROM bl_purchase_in WHERE ISNULL([是否来料检验], N'') = N'');
DECLARE @dictOk INT = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND label = N'是否来料检验' AND dict_sql LIKE N'%是%否%');
PRINT N'检验单头暂收单号仍空: ' + CAST(@inspLeft AS nvarchar(10)) + N' 行(无上游暂收单的老数据不计)';
PRINT N'采购入库行是否来料检验仍空: ' + CAST(@pinLeft AS nvarchar(10)) + N' 行(无链路台账的历史行不计)';
IF @dictOk = 0 RAISERROR(N'是否来料检验 下拉选项未就位', 16, 1);
PRINT N'✅ 暂收单号 / 是否来料检验 回填与元数据补齐完成';
GO
