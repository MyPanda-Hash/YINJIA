-- migrate-panel-runtime-cols.sql — 修 3 处「面板一打开就 500」的结构缺口(2026-09-28)
--
-- 背景(引擎契约):列表面板的查询由服务端统一拼
--     SELECT t.<pk_col> AS __id, … FROM <line_table> t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id …
--   因此**被面板引用的表/视图必须同时具备 pk_col 与 asp_cancel**;明细报表面板还必须提供
--   yj_field 里登记的全部列 —— 任一缺失即整表 500(实测 3 个面板因此点不开)。
--
-- 三处修复:
--  ① erp_imp_row 补审计五件套(建表时漏了;同族 erp_imp_log 齐备)                → 治 ERPLG_ROW 500
--  ② v_wo_schedule 补 id 列(链上 migrate-view-id.sql 的既有口径,当前库被更早定义覆盖) → 治 WO_SCHEDULE 500
--  ③ v_outsource_issue_detail 补齐面板登记的 29 个字段                             → 治 OUTSOURCE_ISSUE_DETAIL 500
--
-- 取值口径说明(不臆造):
--  ③ 的单据状态/审核人/审核时间/审批人/审批时间取自**头表 bd_outsource_issue 自身列**——
--    该单据在 yj_doc_status 里没有任何状态行(2026-09-28 实测 0 行),若按其他明细视图那样从
--    yj_doc_status 派生,状态会恒为「草稿」,反而失真;待该单据纳入状态机后再收敛(规范 §7 阶段 3)。
--  ③ 同时保留既有列 [发料仓库](h.仓库)与 [材料仓库](l.仓库,链上 outsource-reports.sql 口径),
--    并补 [仓库] 本身 —— 面板字段用的是 [仓库],三个都不删,避免打断可能引用它们的脚本。
--
-- 幂等:列用 COL_LENGTH 守卫;视图用 CREATE OR ALTER(重建即最新口径),可重跑。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库
SET NOCOUNT ON;
GO

-- ===== ① erp_imp_row 补审计五件套(新列按规范用 nvarchar(1);同族 erp_imp_log 是 char(1),阶段 3 统一) =====
IF COL_LENGTH('erp_imp_row', 'asp_user1') IS NULL ALTER TABLE erp_imp_row ADD asp_user1 nvarchar(100) NULL;
IF COL_LENGTH('erp_imp_row', 'asp_user2') IS NULL ALTER TABLE erp_imp_row ADD asp_user2 nvarchar(100) NULL;
IF COL_LENGTH('erp_imp_row', 'asp_time1') IS NULL ALTER TABLE erp_imp_row ADD asp_time1 datetime2 NULL;
IF COL_LENGTH('erp_imp_row', 'asp_time2') IS NULL ALTER TABLE erp_imp_row ADD asp_time2 datetime2 NULL;
IF COL_LENGTH('erp_imp_row', 'asp_cancel') IS NULL ALTER TABLE erp_imp_row ADD asp_cancel nvarchar(1) NULL;
GO
-- 列注明(幂等:有则更新无则新增)
DECLARE @t sysname = N'erp_imp_row';
DECLARE @cols TABLE (c sysname, d nvarchar(200));
INSERT INTO @cols VALUES
 (N'asp_user1', N'创建人(审计列)'),
 (N'asp_user2', N'最后修改人(审计列)'),
 (N'asp_time1', N'创建时间(审计列)'),
 (N'asp_time2', N'最后修改时间(审计列)'),
 (N'asp_cancel', N'软删标志(Y=已作废;列表查询按此过滤)');
DECLARE @c sysname, @d nvarchar(200);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT c, d FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(@t), @c, 'ColumnId')
                 AND ep.name = N'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'① erp_imp_row 审计五件套就绪';
GO

-- ===== ② v_wo_schedule 补 id 列(其余列与当前定义逐字一致,只加 w.id) =====
EXEC('CREATE OR ALTER VIEW v_wo_schedule AS
SELECT w.id AS id,
       w.[单据编号] AS 工单号, w.[单据日期] AS 单据日期, w.[销售订单号] AS 销售订单号, w.[客户] AS 客户,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[规格型号] AS 规格型号,
       w.[订单数量] AS 订单数量, w.[成型计划数量] AS 成型计划数量,
       w.[交期] AS 交期,
       CASE WHEN TRY_CAST(w.[交期] AS date) IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), TRY_CAST(w.[交期] AS date)) END AS 交期紧迫度,
       w.[生产车间] AS 生产车间,
       CASE WHEN ISNULL(st.canceled, ''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped, ''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 工单状态,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''混料''), 0) AS 混料完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''成型''), 0) AS 成型完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''切炭''), 0) AS 切炭完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''组装''), 0) AS 组装完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 装箱完成,
       w.[订单数量] - ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 未完成数量,
       CAST(NULL AS char(1)) AS asp_cancel
FROM wo_order w
LEFT JOIN yj_doc_status st ON st.panel_code = ''WO_ORDER'' AND st.doc_no = w.[单据编号]
WHERE ISNULL(st.canceled, ''N'') <> ''Y'';');
PRINT N'② v_wo_schedule 已补 id 列';
GO

-- ===== ③ v_outsource_issue_detail 补齐面板登记的 29 个字段 =====
EXEC('CREATE OR ALTER VIEW v_outsource_issue_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id, l.id) AS id, h.asp_cancel,
       h.[单据日期], h.[单据编号], h.[业务类型], h.[委外供应商], h.[委外加工单号],
       h.[仓库] AS [发料仓库], h.[仓库], h.[部门], h.[经手人], h.[备注],
       h.[单据状态], h.[审核人], h.[审核时间], h.[审批人], h.[审批时间],
       h.asp_user1, h.asp_time1, h.asp_user2, h.asp_time2,
       h.[来源单据], h.[来源单号],
       l.[材料编码], l.[材料名称], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额],
       l.[仓库] AS [材料仓库], l.[行中止]
FROM bd_outsource_issue h LEFT JOIN bl_outsource_issue l ON h.[单据编号]=l.[单据编号];');
PRINT N'③ v_outsource_issue_detail 已补齐面板字段';
GO

-- ===== 验证:三个面板的取数 SQL 都能编译且能取数 =====
SELECT N'ERPLG_ROW' AS panel, COUNT(*) AS 行数 FROM erp_imp_row
UNION ALL SELECT N'WO_SCHEDULE', COUNT(*) FROM v_wo_schedule
UNION ALL SELECT N'OUTSOURCE_ISSUE_DETAIL', COUNT(*) FROM v_outsource_issue_detail;
GO
-- 字段覆盖核对(应为 0 行 = 面板字段全部命中视图/表列)
SELECT RTRIM(f.panel_code) AS panel, f.col_name AS 缺失字段
FROM yj_field f JOIN yj_panel p ON RTRIM(p.panel_code) = RTRIM(f.panel_code)
WHERE RTRIM(f.panel_code) IN ('ERPLG_ROW','WO_SCHEDULE','OUTSOURCE_ISSUE_DETAIL')
  AND p.line_table IS NOT NULL AND OBJECT_ID(p.line_table) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c
                  WHERE c.object_id = OBJECT_ID(p.line_table) AND c.name = f.col_name);
GO
