/* migrate-route-status-switch-audit.sql(2026-10-05):工艺路线「状态」= 开关(默认开)、「审核状态」= 与单据状态联动
 *
 * 用户口径:「当前状态的启用与关闭设置为开关,默认为开」;「审核状态关联当前单据自身状态还是保留这个字段你自己判断」。
 * 判断结果:**保留字段,但让它 = 单据状态**(截图里正好露馅:右上角单据状态「草稿」而字段写着「已审核」,两者能打架)。
 * 实现:字段只读(editable=0)+ **触发器**跟随状态机同步(纯 SQL,不动 Java)。
 *
 * 依据(实测):审核按钮 = `MERGE yj_doc_status ... SET shr=审核人, shsj=GETDATE()`;弃审清 shr;
 *   引擎单据状态由 yj_doc_status 派生(archived='Y'→已归档 / pending='Y'→审批中 / shr 非空→已审核 / 否则草稿)。
 *
 * ① 状态:改「是否」开关(前端 data_type==='是否' 渲染 el-switch,与 是否连续委外 同款),新增默认 'Y'(开);
 * ② 审核状态:改只读;按 yj_doc_status 回填 + 触发器持续同步(已审核/未审核);
 * 幂等可重跑;两账套均执行。
 */

/* ① 状态 = 开关,默认开 */
UPDATE yj_field SET data_type = N'是否', place = N'query,header', required = 0, editable = 1, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'状态';
UPDATE bs_route SET 状态 = CASE WHEN ISNULL(状态, N'') IN (N'', N'Y', N'启用', N'是', N'1') THEN N'Y' ELSE N'N' END;
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id = dc.parent_object_id
                AND c.column_id = dc.parent_column_id
               WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bs_route') AND c.name = N'状态')
  ALTER TABLE bs_route ADD DEFAULT ('Y') FOR [状态];
GO

/* ② 审核状态 = 单据状态的业务投影(只读 + 触发器同步) */
UPDATE yj_field SET editable = 0, place = N'query,header', data_type = N'文本', required = 0, visible = 1, hidden = 0
 WHERE panel_code = N'ROUTE' AND col_name = N'审核状态';
GO
/* 回填:已审核 ⇔ yj_doc_status.shr 非空 或 archived='Y' */
UPDATE r SET r.审核状态 = CASE WHEN s.shr IS NOT NULL OR ISNULL(s.archived,'N') = 'Y' THEN N'已审核' ELSE N'未审核' END
  FROM bs_route r
  LEFT JOIN yj_doc_status s ON s.panel_code = N'ROUTE' AND s.doc_no = r.工艺路线编码;
GO
/* 触发器:状态机变则同步(与 docStatusOf 同口径的简化投影) */
CREATE OR ALTER TRIGGER trg_yj_doc_status_route_audit ON yj_doc_status AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM inserted WHERE panel_code = N'ROUTE') RETURN;
  UPDATE r SET r.审核状态 = CASE WHEN i.shr IS NOT NULL OR ISNULL(i.archived,'N') = 'Y' THEN N'已审核' ELSE N'未审核' END
    FROM bs_route r JOIN inserted i ON i.panel_code = N'ROUTE' AND i.doc_no = r.工艺路线编码;
END
GO

/* ③ 自检 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'状态'
               AND data_type = N'是否' AND place LIKE N'%header%') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id = dc.parent_object_id
                AND c.column_id = dc.parent_column_id
               WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bs_route') AND c.name = N'状态') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'ROUTE' AND col_name = N'审核状态' AND editable = 0) SET @bad = @bad + 1;
IF OBJECT_ID(N'trg_yj_doc_status_route_audit') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM bs_route WHERE ISNULL(状态, N'') NOT IN (N'Y', N'N')) SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工艺路线状态开关/审核状态联动自检失败', 16, 1);
ELSE PRINT N'工艺路线就绪:状态=是否开关(默认 Y=开);审核状态=只读且由触发器跟随单据状态';
GO