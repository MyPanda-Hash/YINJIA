/* ============================================================================
 * 采购订单「材料码打印单」—— 供应商自行打码场景的**批次号登记与预约**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-04 拍板,详见 docs/plans/2026-10-04-采购订单材料码批次号方案.md):
 *   ① **批次号前移**:供应商自己打码时,标签上必须印批次号,而批次号原本要到"生单那一刻"才有
 *      ⇒ 打印时就要能填(按现行公式预填:供应商编码去 YJ- 前缀 + - + 打印当天 yyyyMMdd)、且可人工改;
 *   ② 打印记录 = 该采购订单上批次号的**权威登记处**;生单只是**消费**它,不再按公式重算
 *      (标签已贴到实物上,系统只能服从);
 *   ③ **打印即预约**:未生单的预约量从「剩余可送 / 可送上限」里扣减;打印记录作废即释放;
 *   ④ 单据号 `MQ-yyyy-MM-nnnn`(走 s_allno 号池,零面板成本);
 *   ⑤ **不建面板**(用户明确不要):不插 yj_panel/yj_field、不进菜单、不配权限,
 *      仅做**表级**在册登记(tools/db-inuse-tables.txt + docs/development/数据库表清单.md)。
 *
 * 两张表(按《数据库规范》§1.1 硬规矩 3:单据必须 bd_ 头 + bl_ 行成对,禁止单表承载头行;
 * 中文列名、bigint identity 主键、齐备 asp_user1/2 + asp_time1/2 + asp_cancel nvarchar(1)):
 *   bd_pu_label — 头:**一批次号一张**(同订单 + 同批次号复用同一张,重打只累加 打印次数,不重复占用)
 *   bl_pu_label — 行:该批次号下**每个采购订单行打印了多少**
 *                 (采购订单行id = form_flow_link.source_line_key 的锚,即 "{采购订单号}#{行id}" 里的行id)
 *
 * ⚠ **刻意不写「已生单数量」列**:已生单量一律从 form_flow_link **派生** ——
 *   Σ linked_quantity WHERE source_line_key = 该行 AND batch_no = 该批次号 AND link_status='ACTIVE'。
 *   好处:下游单作废/删除时 VoucherFlowService.release 把 link 置 RELEASED ⇒ 预约**自动回落**,
 *   零额外回滚代码,且与「余量」口径同一真源(不会出现"预约说已生单、link 说没生"的两套账)。
 *
 * ⚠ 筛选(CREATE INDEX ... WHERE)要求 SET QUOTED_IDENTIFIER ON:sqlcmd 默认 OFF 会报 1934,
 *   故脚本头部显式置位(JDBC/SqlRunner 默认已 ON)。
 *
 * 配套代码(同提交):
 *   · PuLabelService        —— 登记打印(幂等复用头)/作废释放/可打印上限/预约与已生单量派生;
 *   · PxController          —— /px/puLabel/lines | print | void 三端点(挂既有 /px 运行时,**不建面板**);
 *   · PushGenerateHandler   —— batchLines 扣预约 + 回「打印预约」明细;generateBatch 按行批次号校验;
 *   · 前端 MaterialLabelDialog.vue(打印弹窗,批次号预填可改 + 勾行填量 + 已打印记录与作废)
 *     + PanelxList(「打印材料码」入口) + BatchSendDialog(「已打印待生单」小表)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- ① 头表:材料码打印单 ---------- */
IF OBJECT_ID(N'dbo.bd_pu_label') IS NULL
CREATE TABLE dbo.bd_pu_label (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bd_pu_label PRIMARY KEY,
    [单据编号]   nvarchar(40)  NOT NULL,
    [单据日期]   date          NOT NULL,
    [采购订单号] nvarchar(200) NOT NULL,
    [供应商编码] nvarchar(100) NULL,
    [批次号]     nvarchar(100) NOT NULL,
    [打印人]     nvarchar(50)  NULL,
    [打印时间]   datetime2     NULL,
    [打印次数]   int           NOT NULL CONSTRAINT df_bd_pu_label_times DEFAULT 0,
    [备注]       nvarchar(500) NULL,
    asp_user1    nvarchar(50)  NULL,
    asp_time1    datetime2     NULL,
    asp_user2    nvarchar(50)  NULL,
    asp_time2    datetime2     NULL,
    asp_cancel   nvarchar(1)   NOT NULL CONSTRAINT df_bd_pu_label_cancel DEFAULT N'N'
);
GO

/* ---------- ② 行表:本批次号下每个订单行的打印量 ---------- */
IF OBJECT_ID(N'dbo.bl_pu_label') IS NULL
CREATE TABLE dbo.bl_pu_label (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bl_pu_label PRIMARY KEY,
    [单据编号]   nvarchar(40)   NOT NULL,
    [采购订单行号] nvarchar(50) NULL,
    [采购订单行id] int          NULL,
    [物料编码]   nvarchar(100)  NULL,
    [物料名称]   nvarchar(200)  NULL,
    [规格型号]   nvarchar(200)  NULL,
    [计量单位]   nvarchar(50)   NULL,
    [打印数量]   decimal(18,4)  NOT NULL CONSTRAINT df_bl_pu_label_qty DEFAULT 0,
    [备注]       nvarchar(500)  NULL,
    asp_user1    nvarchar(50)   NULL,
    asp_time1    datetime2      NULL,
    asp_user2    nvarchar(50)   NULL,
    asp_time2    datetime2      NULL,
    asp_cancel   nvarchar(1)    NOT NULL CONSTRAINT df_bl_pu_label_cancel DEFAULT N'N'
);
GO

/* ---------- ③ 索引 ---------- */
-- 同订单 + 同批次号只有一张存活头(重打复用;作废后可有新的)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_bd_pu_label_order_batch' AND object_id = OBJECT_ID(N'dbo.bd_pu_label'))
    CREATE UNIQUE INDEX uq_bd_pu_label_order_batch ON dbo.bd_pu_label ([采购订单号], [批次号])
        WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_bl_pu_label_doc_line' AND object_id = OBJECT_ID(N'dbo.bl_pu_label'))
    CREATE UNIQUE INDEX uq_bl_pu_label_doc_line ON dbo.bl_pu_label ([单据编号], [采购订单行id])
        WHERE asp_cancel = N'N';
GO
-- 预约与已生单量都按「采购订单行id」聚合,这是最热的两条查询路径
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bl_pu_label_line' AND object_id = OBJECT_ID(N'dbo.bl_pu_label'))
    CREATE INDEX ix_bl_pu_label_line ON dbo.bl_pu_label ([采购订单行id], [单据编号]) WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bd_pu_label_order' AND object_id = OBJECT_ID(N'dbo.bd_pu_label'))
    CREATE INDEX ix_bd_pu_label_order ON dbo.bd_pu_label ([采购订单号], [批次号]) WHERE asp_cancel = N'N';
GO

/* ---------- ④ 中文注明(表 + 业务列;asp_* 由规范统一约定,豁免) ---------- */
DECLARE @c TABLE (tbl sysname, col sysname, txt nvarchar(400));
INSERT INTO @c (tbl, col, txt) VALUES
  (N'bd_pu_label', N'__TABLE__', N'采购订单材料码打印单(头):供应商自行打码时批次号的登记处——一批次号一张,同订单+同批次号复用同一张(重打只累加打印次数,不重复占用余量);打印即预约,未生单预约量从余量里扣减,作废即释放'),
  (N'bd_pu_label', N'单据编号',   N'打印单号:MQ-yyyy-MM-nnnn(FormNoService 走 s_allno 号池)'),
  (N'bd_pu_label', N'单据日期',   N'打印日期(当天)'),
  (N'bd_pu_label', N'采购订单号', N'来源采购订单号(bd_pu_order.单据编号);与批次号一起唯一标识一张打印单'),
  (N'bd_pu_label', N'供应商编码', N'打印时的供应商编码快照(订单编码后续可能被改,打印事实以快照为准)'),
  (N'bd_pu_label', N'批次号',     N'★本批材料码上的批次号:默认=供应商编码去掉 YJ- 前缀 + - + 打印当天 yyyyMMdd,可人工改;打印后即为该订单上批次号的权威值,生单按它落库、不再按公式重算'),
  (N'bd_pu_label', N'打印人',     N'最近一次打印操作人'),
  (N'bd_pu_label', N'打印时间',   N'最近一次打印时间'),
  (N'bd_pu_label', N'打印次数',   N'累计打印次数(重打累加,便于追溯"这批标签打过几次")'),
  (N'bd_pu_label', N'备注',       N'备注'),
  (N'bl_pu_label', N'__TABLE__',  N'采购订单材料码打印单(行):本批次号下每个采购订单行打印了多少;采购订单行id 与 form_flow_link.source_line_key 的 "{采购订单号}#{行id}" 同锚;已生单量不落本表,由 form_flow_link 派生'),
  (N'bl_pu_label', N'单据编号',   N'所属打印单号(bd_pu_label.单据编号)'),
  (N'bl_pu_label', N'采购订单行号', N'采购订单行号(展示用,bl_pu_order.行号)'),
  (N'bl_pu_label', N'采购订单行id', N'采购订单行 id(锚):与 form_flow_link.source_line_key 的 #id 同源,预约/已生单量按它聚合'),
  (N'bl_pu_label', N'物料编码',   N'物料编码(打印时快照)'),
  (N'bl_pu_label', N'物料名称',   N'物料名称(打印时快照)'),
  (N'bl_pu_label', N'规格型号',   N'规格型号(打印时快照)'),
  (N'bl_pu_label', N'计量单位',   N'计量单位(打印时快照)'),
  (N'bl_pu_label', N'打印数量',   N'本批次号下该订单行的打印量(即预约量);未生单部分=打印数量−已生单量(form_flow_link 派生)'),
  (N'bl_pu_label', N'备注',       N'备注');

DECLARE @tbl sysname, @col sysname, @txt nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @c;
OPEN cur; FETCH NEXT FROM cur INTO @tbl, @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @col = N'__TABLE__'
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @tbl) AND minor_id = 0 AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl;
    END
    ELSE IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NOT NULL
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId')
                     AND name = 'MS_Description')
            EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
        ELSE
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'④ 两张表的中文注明已写入';
GO

/* ---------- ⑤ 自检 ---------- */
IF OBJECT_ID(N'dbo.bd_pu_label') IS NULL RAISERROR(N'自检失败:bd_pu_label 未建', 16, 1);
IF OBJECT_ID(N'dbo.bl_pu_label') IS NULL RAISERROR(N'自检失败:bl_pu_label 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_pu_label') AND minor_id = 0 AND name = 'MS_Description')
    RAISERROR(N'自检失败:bd_pu_label 缺表级中文注明', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_pu_label') AND minor_id = 0 AND name = 'MS_Description')
    RAISERROR(N'自检失败:bl_pu_label 缺表级中文注明', 16, 1);

-- 规范必备列齐备性(bigint 主键 / asp_user1-2 / asp_time1-2 / asp_cancel nvarchar(1))
IF EXISTS (
    SELECT 1 FROM (VALUES (N'bd_pu_label'), (N'bl_pu_label')) v(t)
    WHERE NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + v.t) AND c.name = 'asp_user1' AND TYPE_NAME(c.user_type_id) = 'nvarchar')
       OR NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + v.t) AND c.name = 'asp_time2' AND TYPE_NAME(c.user_type_id) = 'datetime2')
       OR NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + v.t) AND c.name = 'asp_cancel' AND TYPE_NAME(c.user_type_id) = 'nvarchar' AND c.max_length = 2))
    RAISERROR(N'自检失败:必备列(asp_user1/asp_time2/asp_cancel nvarchar(1))不齐', 16, 1);

-- 两张表都不应出现在 yj_panel(用户明确不建面板)
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code IN (N'bd_pu_label', N'bl_pu_label', N'PU_LABEL'))
    RAISERROR(N'自检失败:本需求不建面板,却发现了面板注册', 16, 1);

SELECT N'自检' AS k, t.name AS 表, c.name AS 列, TYPE_NAME(c.user_type_id) AS 类型, c.max_length AS 长度
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN (N'bd_pu_label', N'bl_pu_label')
ORDER BY t.name, c.column_id;
GO
PRINT N'✅ 材料码打印单两张表就绪(bd_pu_label 头 + bl_pu_label 行;不建面板)';
GO
