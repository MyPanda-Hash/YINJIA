/* =============================================================================
   migrate-wo-pick-scan-log-20261021.sql
   -----------------------------------------------------------------------------
   目的：工单扫码领料的**逐笔操作留痕**（用户口径 2026-10-21：
     「要监控 App 使用情况，因为这个取数上报的要能看到他们的操作情况」
     + 「还要记『扫了哪些料、各多少、什么时候』——更细，需要新表」）。

   为什么另建一张表，不复用 yj_usage_log：
     yj_usage_log 是「谁在哪个面板点了哪个按钮」的粗粒度事件（9 列，
     panel_name/action_name/doc_no/ip），装不下「哪张工单、哪个行、哪个物料、
     多少数量、秤读数多少、是相机扫还是扫码枪、App 还是网页」这些业务事实。
     而扫码明细是**可追溯的作业流水**（后续要对账、要查谁多领了），
     与操作日志的生命周期和查询口径都不同 ⇒ 独立成表。

   表名：wo_pick_scan_log（wo_ = 生产执行域，与 wo_transfer_log / wo_split_log 同族；
     两张表都是「作业留痕」性质，前缀一致便于归组）。

   只增不改：留痕表，业务侧不 UPDATE、不 DELETE；撤销靠 asp_cancel 标记（沿用全库惯例）。

   幂等：IF OBJECT_ID(...) IS NULL 建表；索引同理；注释先查后加。
   两账套都要执行（先 HSDZ_MES 后 HSDZ_MES_TEST）。
   ============================================================================= */

SET NOCOUNT ON;
GO

/* ---------- 1. 建表 ---------- */
IF OBJECT_ID('dbo.wo_pick_scan_log', 'U') IS NULL
CREATE TABLE dbo.wo_pick_scan_log (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_pick_scan_log PRIMARY KEY,
  -- 作业对象
  wo_no         nvarchar(50)   NOT NULL,   -- 工单号(plang.pl_no)
  wo_line       int            NOT NULL,   -- 工单行号(plang.pl_xc)
  product_code  nvarchar(50)   NULL,       -- 产品编码(plang.dm)
  -- 扫码明细
  material_code nvarchar(50)   NOT NULL,   -- 子件代码(mate.wzdm2)
  material_name nvarchar(200)  NULL,       -- 子件名称
  qty           decimal(18,4)  NOT NULL,   -- 本次扫码数量
  unit          nvarchar(20)   NULL,       -- 计量单位
  -- 秤取数(用户口径「自动抓取台车电子秤数量」)
  scale_value   decimal(18,4)  NULL,       -- 电子秤读数(未取秤时为空)
  scale_device  nvarchar(50)   NULL,       -- 秤设备编码(bs_dc_device.code)
  scale_at      datetime2      NULL,       -- 秤采样时刻
  -- 作业上下文
  scan_type     nvarchar(20)   NOT NULL DEFAULT (N'物料'),  -- 工单/物料
  scan_source   nvarchar(20)   NULL,       -- 相机/扫码枪/手输(App 内为「相机」)
  client_type   nvarchar(20)   NULL,       -- App/Web(区分手机 App 与电脑网页)
  client_info   nvarchar(200)  NULL,       -- 设备/版本标识(User-Agent 或 App 版本)
  ip            nvarchar(50)   NULL,       -- 来源 IP
  -- 提交关联
  doc_no        nvarchar(50)   NULL,       -- 最终生成的领料单号(材料出库单)
  -- 审计列(全库惯例)
  asp_user1     nvarchar(50)   NULL,       -- 创建人(登录账号)
  asp_time1     datetime2      NULL,       -- 创建时间
  asp_user2     nvarchar(50)   NULL,       -- 最后修改人
  asp_time2     datetime2      NULL,       -- 最后修改时间
  asp_cancel    char(1)        NULL DEFAULT ('N'),  -- 作废标记(Y=作废,留痕不删)
  remark        nvarchar(500)  NULL        -- 备注(失败原因等)
);
GO

/* ---------- 2. 索引(按最常用的三种查法) ---------- */
-- 按人查「今天扫了什么」:创建人 + 时间倒序
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_scan_log_user_at' AND object_id = OBJECT_ID('dbo.wo_pick_scan_log'))
  CREATE INDEX IX_wo_pick_scan_log_user_at ON dbo.wo_pick_scan_log(asp_user1, asp_time1 DESC);
GO
-- 按工单查「这单谁扫的、扫了哪些料」
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_scan_log_wo' AND object_id = OBJECT_ID('dbo.wo_pick_scan_log'))
  CREATE INDEX IX_wo_pick_scan_log_wo ON dbo.wo_pick_scan_log(wo_no, wo_line, asp_time1 DESC);
GO
-- 按领料单号回查(提交后对账)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_scan_log_doc' AND object_id = OBJECT_ID('dbo.wo_pick_scan_log'))
  CREATE INDEX IX_wo_pick_scan_log_doc ON dbo.wo_pick_scan_log(doc_no) WHERE doc_no IS NOT NULL;
GO

/* ---------- 3. 中文注明(表级) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.wo_pick_scan_log') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'工单扫码领料明细留痕:每次扫码一行(谁/何时/哪张工单哪一行/扫了哪个物料/多少数量/秤读数/相机还是扫码枪);只增不改',
       N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_scan_log';
GO

/* ---------- 4. 中文注明(列级) ---------- */
DECLARE @c TABLE (col sysname, descr nvarchar(200));
INSERT INTO @c (col, descr) VALUES
 (N'id',            N'主键(自增)'),
 (N'wo_no',         N'工单号(plang.pl_no)'),
 (N'wo_line',       N'工单行号(plang.pl_xc)'),
 (N'product_code',  N'产品编码(plang.dm)'),
 (N'material_code', N'子件代码(mate.wzdm2)'),
 (N'material_name', N'子件名称'),
 (N'qty',           N'本次扫码数量'),
 (N'unit',          N'计量单位'),
 (N'scale_value',   N'电子秤读数(未取秤时为空)'),
 (N'scale_device',  N'秤设备编码(bs_dc_device.code)'),
 (N'scale_at',      N'秤采样时刻'),
 (N'scan_type',     N'扫码类型(工单/物料)'),
 (N'scan_source',   N'扫码方式(相机/扫码枪/手输)'),
 (N'client_type',   N'客户端类型(App/Web)'),
 (N'client_info',   N'设备或版本标识'),
 (N'ip',            N'来源 IP'),
 (N'doc_no',        N'最终生成的领料单号(材料出库单)'),
 (N'asp_user1',     N'创建人(登录账号)'),
 (N'asp_time1',     N'创建时间'),
 (N'asp_user2',     N'最后修改人'),
 (N'asp_time2',     N'最后修改时间'),
 (N'asp_cancel',    N'作废标记(Y=作废,留痕不删)'),
 (N'remark',        N'备注(失败原因等)');

DECLARE @col sysname, @cd nvarchar(200);
DECLARE cur CURSOR FAST_FORWARD LOCAL FOR SELECT col, descr FROM @c;
OPEN cur; FETCH NEXT FROM cur INTO @col, @cd;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 JOIN sys.columns cl ON cl.object_id = ep.major_id AND cl.column_id = ep.minor_id
                 WHERE ep.major_id = OBJECT_ID('dbo.wo_pick_scan_log')
                   AND ep.name = N'MS_Description' AND cl.name = @col)
    EXEC sp_addextendedproperty N'MS_Description', @cd,
         N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_scan_log', N'COLUMN', @col;
  FETCH NEXT FROM cur INTO @col, @cd;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- 5. 自检(缺注则报错) ---------- */
DECLARE @cols int, @cmt int;
SELECT @cols = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.wo_pick_scan_log');
SELECT @cmt = COUNT(*) FROM sys.extended_properties ep
  JOIN sys.columns cl ON cl.object_id = ep.major_id AND cl.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.wo_pick_scan_log') AND ep.name = N'MS_Description';
IF @cmt < @cols
  RAISERROR(N'wo_pick_scan_log 列级注明缺失(%d/%d)', 16, 1, @cmt, @cols);
GO
