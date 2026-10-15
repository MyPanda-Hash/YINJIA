/* ============================================================
   migrate-route-must-audited-20261016.sql — 2026-10-16
   工艺路线(ROUTE)「审核完成后才能被使用」:口径 + 存量基线补齐

   用户口径(2026-10-16):
     · 「当前能工艺路线需要被审核完成后才能被使用」——
       转工单(生成工单那一步)所选的工艺路线必须是**已审核**的，否则拒绝生成工单。

   背景与现状(实测 HSDZ_MES):
     · ROUTE 面板 yj_panel.mode='doc' ⇒ 本来就走审核/审批状态机，
       字段「审核状态」(只读，editable=0)由触发器 trg_yj_doc_status_route_audit
       跟随 yj_doc_status 派生(已审核/未审核)。
     · 但**代码侧从未校验**：订单结转/快速排产生成工单时只校验"有没有选路线"，
       不管它审没审 ⇒ 未审核的路线照样能投产。

   本脚本做两件事(都是**幂等、纯数据/元数据**，不动代码逻辑):
     ① 修「审核状态」字段的口径：由"跟随单据状态"改为"跟随验收结论"。
        原触发器把 pending='Y'(审批中)/canceled='Y'(已作废) 也投成「已审核」，
        与字段名打架(审批中≠审核完成)。改为按 **shr 非空 且 未作废/未中止** 判已审核。
     ② 存量基线补齐(用户选择"自动补基线")：
        把**已被工单使用**、但 yj_doc_status 尚无登记或未审核的工艺路线，
        按"当时投产即视为验收过"补一条已审核留痕(shr='migrate-route-baseline')。
        这样在产工单不受影响，而以后新转的工单必须选已审核路线。

   ⚠ 不动任何"未投产"的路线(GY-001/002/003 这类样板数据保持未审核：
      它们没被任何工单用过，强行补审反而绕过了"要审核才能用"的本意)。
     不动来料检验单 QC_INSP / 生产日报 DAY_REPORT / 三张工序检验单的同名字段。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */

IF OBJECT_ID(N'dbo.bs_route', N'U') IS NULL
    PRINT N'[skip] bs_route 不存在，本脚本无可执行对象';

SET NOCOUNT ON;
GO

/* ---------- ① 「审核状态」口径改为"验收结论"(审批中/作废 不算已审核) ---------- */
UPDATE yj_field SET data_type = N'文本', place = N'query,header', seq = 50,
                    editable = 0, required = 0, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'审核状态';
GO

/* 回填:已审核 = shr 非空 且 未作废 且 未中止(审批中/待二级/草稿 一律"未审核") */
UPDATE r SET r.审核状态 = CASE
        WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(s.stopped,'N') <> 'Y'
             AND ISNULL(s.deleting,'N') <> 'Y' AND ISNULL(s.modify_state,'N') <> 'Y'
        THEN N'已审核' ELSE N'未审核' END
  FROM dbo.bs_route r
  LEFT JOIN dbo.yj_doc_status s ON s.panel_code = N'ROUTE' AND s.doc_no = r.工艺路线编码;
GO

/* 触发器同口径改写(状态机任一变动都重新投影) */
CREATE OR ALTER TRIGGER trg_yj_doc_status_route_audit ON dbo.yj_doc_status AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted WHERE panel_code = N'ROUTE') RETURN;
    UPDATE r SET r.审核状态 = CASE
            WHEN i.shr IS NOT NULL AND ISNULL(i.canceled,'N') <> 'Y' AND ISNULL(i.stopped,'N') <> 'Y'
                 AND ISNULL(i.deleting,'N') <> 'Y' AND ISNULL(i.modify_state,'N') <> 'Y'
            THEN N'已审核' ELSE N'未审核' END
      FROM dbo.bs_route r
      JOIN inserted i ON i.panel_code = N'ROUTE' AND i.doc_no = r.工艺路线编码;
END
GO

/* ---------- ② 存量基线:已被工单使用的未审核路线，补已审核留痕 ----------
   口径:plang.[工艺路线] 里出现过的编码(未作废工单)，且该路线未作废、未审批中。
   "当时投产即视为验收过" ⇒ 直接置 shr(跳过审批流，避免给历史单凭空造审批过程)。
   shr 用固定值 'migrate-route-baseline'，一眼能识别是基线补的，不是人审的。 */
UPDATE s SET
      s.shr = N'migrate-route-baseline',
      s.shsj = GETDATE(),
      s.saved = 'Y',
      s.pending = 'N',
      s.approve_node = NULL,
      s.update_at = GETDATE()
  FROM dbo.yj_doc_status s
 WHERE s.panel_code = N'ROUTE'
   AND s.doc_no IN (SELECT DISTINCT ISNULL(p.[工艺路线], N'')
                      FROM dbo.plang p
                     WHERE ISNULL(p.[工艺路线], N'') <> N''
                       AND ISNULL(p.asp_cancel,'N') <> 'Y')
   AND ISNULL(s.canceled,'N') <> 'Y'          -- 作废的路线不救
   AND ISNULL(s.stopped,'N')  <> 'Y'          -- 中止的路线不救
   AND s.shr IS NULL;                         -- 尚未审核
GO

/* 有些路线**连 yj_doc_status 行都没有**(保存时引擎只对单据写状态，
   样板路线 GY-001 等从未走审核 ⇒ 无状态行)：已被工单使用的补建一条已审核行。 */
INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, saved, pending, canceled, update_at)
SELECT DISTINCT N'ROUTE', p.[工艺路线], N'migrate-route-baseline', GETDATE(), 'Y', 'N', 'N', GETDATE()
  FROM dbo.plang p
 WHERE ISNULL(p.[工艺路线], N'') <> N''
   AND ISNULL(p.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s
                    WHERE s.panel_code = N'ROUTE' AND s.doc_no = p.[工艺路线]);
GO

/* 补完状态行后，"审核状态"列要跟着投影一次(上面触发器已对 UPDATE 生效，这里覆盖 INSERT 的行) */
UPDATE r SET r.审核状态 = N'已审核'
  FROM dbo.bs_route r
  JOIN dbo.yj_doc_status s ON s.panel_code = N'ROUTE' AND s.doc_no = r.工艺路线编码
 WHERE s.shr = N'migrate-route-baseline'
   AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(s.stopped,'N') <> 'Y';
GO

/* ---------- 自检 ---------- */
DECLARE @bad int = 0;

/* (a) 「审核状态」必须是只读文本字段 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态'
               AND editable = 0 AND data_type = N'文本') SET @bad = @bad + 1;

/* (b) 验收结论一致性:bs_route.审核状态 与触发器口径零偏差 */
IF EXISTS (SELECT 1 FROM dbo.bs_route r
             LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码
            WHERE ISNULL(r.审核状态, N'') <> CASE
                    WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y'
                         AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.modify_state,'N')<>'Y'
                    THEN N'已审核' ELSE N'未审核' END)
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 有路线的「审核状态」与派生口径不一致';
END

/* (c) 🔴 核心闸门:被工单使用的路线必须已审核(代码侧也会拦，这里是数据基线自检) */
IF EXISTS (SELECT 1
             FROM (SELECT DISTINCT p.[工艺路线] FROM dbo.plang p
                    WHERE ISNULL(p.[工艺路线], N'') <> N'' AND ISNULL(p.asp_cancel,'N') <> 'Y') u
             LEFT JOIN dbo.yj_doc_status s ON s.panel_code = 'ROUTE' AND s.doc_no = u.[工艺路线]
            WHERE s.shr IS NULL
               OR ISNULL(s.canceled,'N') = 'Y' OR ISNULL(s.stopped,'N') = 'Y')
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 仍有工单在用的工艺路线未审核(补基线未覆盖)';
END

/* (d) 未被工单使用的样板路线**不许被顺手补审**(否则"要审核才能用"就被绕过了) */
DECLARE @unusedAudited int;
SELECT @unusedAudited = COUNT(*)
  FROM dbo.bs_route r
  JOIN dbo.yj_doc_status s ON s.panel_code = 'ROUTE' AND s.doc_no = r.工艺路线编码
 WHERE s.shr = N'migrate-route-baseline'
   AND r.工艺路线编码 NOT IN (SELECT p.[工艺路线] FROM dbo.plang p
                               WHERE ISNULL(p.[工艺路线], N'') <> N'' AND ISNULL(p.asp_cancel,'N') <> 'Y');
IF @unusedAudited > 0
BEGIN
    SET @bad = @bad + 1;
    PRINT N'  ! 有 ' + CAST(@unusedAudited AS nvarchar(10)) + N' 条未被工单使用的路线被误补审核';
END

/* (e) 🔴 守卫:同名字段不许误伤 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'QC_INSP' AND label=N'合格数量')
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code=N'DAY_REPORT' AND label=N'合格数量')
    SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'工艺路线「审核后才能使用」自检失败(%d 项)', 16, 1, @bad);
ELSE PRINT N'工艺路线就绪:转工单只认已审核路线;存量在产路线已补审核基线;样板未审路线保持未审核';
GO
