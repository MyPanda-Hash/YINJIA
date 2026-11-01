/* ============================================================
   migrate-wo-proc-card-20261029.sql — 2026-10-29
   工序流程追踪卡(生产计划 → 工序流程追踪卡,页面级虚拟面板 PROC_FLOW_CARD)

   需求来源:用户口述《新建 DOCX 文档 (2).docx》(生产相关)。逐句落地见
   docs/design/工序流程追踪卡-V1.0.md §0。要点:
     · 批次号当前形式=日期 ⇒ 大批次(日期) 下挂 小批次(日期-流水);
     · 小批次有各自工序照片(电脑选图 / 手机拍照导入);
     · 录入界面(批次号,照片)、列表界面(按产品物料查)、查询界面(按批次查);
     · 工序流程卡挂载到当前工序完成(工序完成量/完成时间取已审核报工),追溯按卡;
     · 只管制程,来料仍走采购链四批(本卡不碰材料批次)。

   本脚本(只加对象,不改既有表):
     ① 建 wo_proc_card_head(卡头:批次/小批次/工单行/产品/计划数量/卡状态/确认留痕);
     ② 建 wo_proc_card_detail(卡的工序行:工序序/工序/工序编码/车间/计划数量/生产线快照);
        —— 完成数量/状态/完成时间**不落库**,查询时从已审核报工 scjl 现算(防两账不合一);
     ③ 两表 + 逐列 MS_Description 中文注明(数据库规范:新表必须带注释);
     ④ 唯一键:卡号唯一;业务唯一(大批次号, 工单行id) WHERE asp_cancel='N';
        工序行唯一(卡id, 工序序) WHERE asp_cancel='N';另加批次查询索引;
     ⑤ 授权:yj_role_panel 每角色一行 PROC_FLOW_CARD = view,query,entry,confirm(缺才插);
     ⑥ 译名:面板名 + 页面动作词 en/ja/ko/vi 入 yj_translation(AGENTS 多语言强制规范);
     ⑦ 自检:表/索引/注明/授权/译名缺一即 RAISERROR(16) —— 两账套执行(先正式、后测试)。

   照片:复用既有 yj_attachment(panel_code='PROC_FLOW_CARD', doc_no=卡号,
        field_key='工序照片-<工序序>'),**不新建照片表** —— 上传/删除/下载沿用
        /api/attachment/ 下的上传/删除/下载接口与磁盘存储;需 AttachmentService.syncHeadField
        对虚拟面板容错(代码同批)。

   幂等:全部 IF NOT EXISTS / MERGE 式判重,可重复执行。
   回滚:tools/archive/_proc-card-rollback-20261029.sql(链外手工执行,勿登记)。
   ============================================================ */
SET NOCOUNT ON;

/* ── ① 卡头 ─────────────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.wo_proc_card_head', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_proc_card_head (
        id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_proc_card_head PRIMARY KEY,
        [卡号]      nvarchar(60)   NOT NULL,
        [大批次号]  nvarchar(60)   NOT NULL,
        [小批次号]  nvarchar(60)   NOT NULL,
        [批次来源]  nvarchar(20)   NULL,
        [工单号]    nvarchar(100)  NOT NULL,
        [工单行号]  int            NULL,
        [工单行id]  bigint         NOT NULL,
        [产品编码]  nvarchar(100)  NULL,
        [产品名称]  nvarchar(400)  NULL,
        [规格型号]  nvarchar(400)  NULL,
        [计划数量]  decimal(18,4)  NOT NULL CONSTRAINT DF_wo_proc_card_head_qty DEFAULT (0),
        [生产线]    nvarchar(100)  NULL,
        [工艺路线]  nvarchar(100)  NULL,
        [卡状态]    nvarchar(20)   NULL,
        [确认人]    nvarchar(100)  NULL,
        [确认时间]  datetime2(3)   NULL,
        [备注]      nvarchar(800)  NULL,
        [asp_user1] nvarchar(100)  NULL,
        [asp_time1] datetime2(3)   NULL,
        [asp_user2] nvarchar(100)  NULL,
        [asp_time2] datetime2(3)   NULL,
        [asp_cancel] nvarchar(1)   NOT NULL CONSTRAINT DF_wo_proc_card_head_cancel DEFAULT (N'N')
    );
END
GO
-- 2026-10-29 补列(表首次建出后再加):批次来源 —— 生产批次号只在工单行「生产完工」时才生成
-- (ProcessTaskService.assignProductionBatch:批次号=完工当天日期),录入期多数工单行还没有批次号,
-- 故卡头先按「工单日期」推定,等真实批次号生成后由服务端自动同步并把来源改为「生产批次」。
IF COL_LENGTH(N'dbo.wo_proc_card_head', N'批次来源') IS NULL
    ALTER TABLE dbo.wo_proc_card_head ADD [批次来源] nvarchar(20) NULL;
GO

/* ── ② 卡的工序行 ───────────────────────────────────────────────── */
IF OBJECT_ID(N'dbo.wo_proc_card_detail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_proc_card_detail (
        id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_proc_card_detail PRIMARY KEY,
        [卡id]      bigint         NOT NULL,
        [卡号]      nvarchar(60)   NOT NULL,
        [工序序]    int            NOT NULL CONSTRAINT DF_wo_proc_card_detail_seq DEFAULT (0),
        [工序]      nvarchar(100)  NOT NULL CONSTRAINT DF_wo_proc_card_detail_op DEFAULT (N''),
        [工序编码]  nvarchar(50)   NULL,
        [生产车间]  nvarchar(100)  NULL,
        [计划数量]  decimal(18,4)  NOT NULL CONSTRAINT DF_wo_proc_card_detail_qty DEFAULT (0),
        [计划生产线] nvarchar(100) NULL,
        [实际生产线] nvarchar(100) NULL,
        [备注]      nvarchar(400)  NULL,
        [asp_user1] nvarchar(100)  NULL,
        [asp_time1] datetime2(3)   NULL,
        [asp_user2] nvarchar(100)  NULL,
        [asp_time2] datetime2(3)   NULL,
        [asp_cancel] nvarchar(1)   NOT NULL CONSTRAINT DF_wo_proc_card_detail_cancel DEFAULT (N'N')
    );
END
GO

/* ── ③ 索引 ─────────────────────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_head_doc'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_head'))
    CREATE UNIQUE INDEX UX_wo_proc_card_head_doc ON dbo.wo_proc_card_head([卡号]);
GO
-- 一个工单行只准一张卡(身份=工单行id,与批次号解耦:批次号在完工后才生成、会由服务端同步)。
-- 先删后建:首版脚本曾建在 (大批次号, 工单行id) 上,重跑本脚本时按新口径收敛。
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_head_line'
           AND object_id = OBJECT_ID(N'dbo.wo_proc_card_head'))
    DROP INDEX UX_wo_proc_card_head_line ON dbo.wo_proc_card_head;
GO
CREATE UNIQUE INDEX UX_wo_proc_card_head_line ON dbo.wo_proc_card_head([工单行id])
    WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_proc_card_head_batch'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_head'))
    CREATE INDEX IX_wo_proc_card_head_batch ON dbo.wo_proc_card_head([大批次号], [卡状态])
        INCLUDE ([工单行id], [工单号], [工单行号], [产品编码], [产品名称], [计划数量]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_detail_card_op'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_detail'))
    CREATE UNIQUE INDEX UX_wo_proc_card_detail_card_op ON dbo.wo_proc_card_detail([卡id], [工序序])
        WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_proc_card_detail_card'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_detail'))
    CREATE INDEX IX_wo_proc_card_detail_card ON dbo.wo_proc_card_detail([卡id])
        INCLUDE ([工序序], [工序], [计划数量]);
GO

/* ── ④ 中文注明(表 + 逐列)──────────────────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_head')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'工序流程追踪卡·卡头:一张卡=一个小批次(=日期大批次下的一个工单行);工序行见 wo_proc_card_detail,照片挂 yj_attachment(panel_code=PROC_FLOW_CARD,doc_no=卡号)。完成情况由已审核报工现算,不落冗余完成量',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_head';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'工序流程追踪卡·卡头:一张卡=一个小批次(=日期大批次下的一个工单行);工序行见 wo_proc_card_detail,照片挂 yj_attachment(panel_code=PROC_FLOW_CARD,doc_no=卡号)。完成情况由已审核报工现算,不落冗余完成量',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_head';
GO
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols (col, descr) VALUES
 (N'卡号',      N'流程卡号(唯一;格式 LZK-<工单号>-<工单行号>,如 LZK-GD-2026-10-0018-11)'),
 (N'大批次号',  N'大批次号=生产批次号(日期形态;plang.[批次号]→plang_pc.[批次号]→scjl.[批次号];都没有时暂取工单日期推定,见批次来源)'),
 (N'小批次号',  N'小批次号=<工单号>-<工单行号>(行级小批次标识,一张卡=一个小批次)'),
 (N'批次来源',  N'批次来源(生产批次=来自真实生产批次号;/工单日期=该行尚未生产完工、按工单日期推定;服务端在读到真实批次号后自动同步)'),
 (N'工单号',    N'工单号(plang.pl_no,冗余展示)'),
 (N'工单行号',  N'工单行号(plang.pl_xc)'),
 (N'工单行id',  N'工单行id(=plang.id;行级键,追溯不按工单号整单取数)'),
 (N'产品编码',  N'产品编码(plang.dm 快照)'),
 (N'产品名称',  N'产品名称(plang.mc 快照)'),
 (N'规格型号',  N'规格型号(plang.gg 快照)'),
 (N'计划数量',  N'计划数量(plang.pl_sl 快照)'),
 (N'生产线',    N'生产线(plang.scx 快照)'),
 (N'工艺路线',  N'工艺路线(建卡时工单行/产品档案/默认路线解析结果快照)'),
 (N'卡状态',    N'卡状态(录入中/已完成;完成=人工确认,前置=全部工序已完工且每道工序至少一张照片)'),
 (N'确认人',    N'确认完成操作人'),
 (N'确认时间',  N'确认完成时间'),
 (N'备注',      N'卡备注'),
 (N'asp_user1', N'创建人'),
 (N'asp_time1', N'创建时间'),
 (N'asp_user2', N'最后修改人'),
 (N'asp_time2', N'最后修改时间'),
 (N'asp_cancel', N'作废标志(N=有效,Y=作废;卡删除=软删)');
DECLARE @col sysname, @descr nvarchar(400);
DECLARE cur CURSOR FOR SELECT col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.wo_proc_card_head')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_proc_card_head'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_head', N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_head', N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @col, @descr;
END
CLOSE cur;
DEALLOCATE cur;
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_detail')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'工序流程追踪卡·工序行:一张卡的各道工序(来源=工单工序台账 wo_process_line,按工艺路线生成);完成数量/状态/完成时间不落库,查询时按已审核报工 scjl 现算',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_detail';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'工序流程追踪卡·工序行:一张卡的各道工序(来源=工单工序台账 wo_process_line,按工艺路线生成);完成数量/状态/完成时间不落库,查询时按已审核报工 scjl 现算',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_detail';
GO
DECLARE @cols2 TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols2 (col, descr) VALUES
 (N'卡id',      N'卡头 id(wo_proc_card_head.id)'),
 (N'卡号',      N'卡号(冗余展示,与头一致)'),
 (N'工序序',    N'工序序(取自工序台账 wo_process_line.工序序)'),
 (N'工序',      N'工序名称(成型/切炭/组装/装箱…,与 bs_op.工序名称 同源)'),
 (N'工序编码',  N'工序编码(bs_op.工序编码,可空)'),
 (N'生产车间',  N'归口生产车间(ProcessShop 归口:装箱归组装)'),
 (N'计划数量',  N'计划数量(工序台账按路线换算率折算后的计划量)'),
 (N'计划生产线', N'计划生产线(工序台账快照)'),
 (N'实际生产线', N'实际生产线(工序台账快照)'),
 (N'备注',      N'工序级备注'),
 (N'asp_user1', N'创建人'),
 (N'asp_time1', N'创建时间'),
 (N'asp_user2', N'最后修改人'),
 (N'asp_time2', N'最后修改时间'),
 (N'asp_cancel', N'作废标志(N=有效,Y=作废)');
DECLARE @col2 sysname, @descr2 nvarchar(400);
DECLARE cur2 CURSOR FOR SELECT col, descr FROM @cols2;
OPEN cur2;
FETCH NEXT FROM cur2 INTO @col2, @descr2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.wo_proc_card_detail')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_proc_card_detail'), @col2, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @descr2,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_detail', N'COLUMN', @col2;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @descr2,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_proc_card_detail', N'COLUMN', @col2;
    FETCH NEXT FROM cur2 INTO @col2, @descr2;
END
CLOSE cur2;
DEALLOCATE cur2;
GO

/* ── ⑤ 页面面板授权(每个角色一行;缺才插,已有则补缺词)────────── */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PROC_FLOW_CARD', N'N', N'view,query,entry,confirm'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x
                    WHERE x.role_id = r.id AND x.panel_code = N'PROC_FLOW_CARD');
GO
UPDATE dbo.yj_role_panel
   SET perms = CASE WHEN ISNULL(perms, N'') = N'' THEN N'view,query,entry,confirm'
                    ELSE perms + N',entry' END
 WHERE panel_code = N'PROC_FLOW_CARD' AND ISNULL(perms, N'') NOT LIKE N'%entry%';
GO
UPDATE dbo.yj_role_panel
   SET perms = CASE WHEN ISNULL(perms, N'') = N'' THEN N'view,query,entry,confirm'
                    ELSE perms + N',confirm' END
 WHERE panel_code = N'PROC_FLOW_CARD' AND ISNULL(perms, N'') NOT LIKE N'%confirm%';
GO

/* ── ⑥ 译名:面板名 + 动作词(AGENTS 多语言强制规范)──────────────── */
DECLARE @tr TABLE (scope nvarchar(20), ref_key nvarchar(200), locale nvarchar(20), text nvarchar(400));
INSERT INTO @tr (scope, ref_key, locale, text) VALUES
 (N'panel', N'工序流程追踪卡', N'en', N'Process Flow Tracking Card'),
 (N'panel', N'工序流程追踪卡', N'ja', N'工程フロートレーサビリティカード'),
 (N'panel', N'工序流程追踪卡', N'ko', N'공정 흐름 추적 카드'),
 (N'panel', N'工序流程追踪卡', N'vi', N'Thẻ theo dõi quy trình công đoạn'),
 (N'field', N'录入照片', N'en', N'Enter photos'),
 (N'field', N'录入照片', N'ja', N'写真入力'),
 (N'field', N'录入照片', N'ko', N'사진 입력'),
 (N'field', N'录入照片', N'vi', N'Nhập ảnh'),
 (N'field', N'确认完成', N'en', N'Confirm completion'),
 (N'field', N'确认完成', N'ja', N'完了確認'),
 (N'field', N'确认完成', N'ko', N'완료 확인'),
 (N'field', N'确认完成', N'vi', N'Xác nhận hoàn thành'),
 (N'field', N'小批次号', N'en', N'Sub-batch No.'),
 (N'field', N'小批次号', N'ja', N'サブバッチ番号'),
 (N'field', N'小批次号', N'ko', N'소배치 번호'),
 (N'field', N'小批次号', N'vi', N'Số lô phụ'),
 (N'field', N'大批次号', N'en', N'Main batch No.'),
 (N'field', N'大批次号', N'ja', N'メインバッチ番号'),
 (N'field', N'大批次号', N'ko', N'대배치 번호'),
 (N'field', N'大批次号', N'vi', N'Số lô chính'),
 (N'field', N'卡号', N'en', N'Card No.'),
 (N'field', N'卡号', N'ja', N'カード番号'),
 (N'field', N'卡号', N'ko', N'카드 번호'),
 (N'field', N'卡号', N'vi', N'Số thẻ');
INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @tr t
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* ── ⑦ 自检 ─────────────────────────────────────────────────────── */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.wo_proc_card_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.wo_proc_card_detail', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_head_doc'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_head')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_head_line'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_head')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_proc_card_detail_card_op'
               AND object_id = OBJECT_ID(N'dbo.wo_proc_card_detail')) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_head')
      AND minor_id > 0 AND name = N'MS_Description') < 22 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_detail')
      AND minor_id > 0 AND name = N'MS_Description') < 15 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_head')
                 AND minor_id = 0 AND name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_proc_card_detail')
                 AND minor_id = 0 AND name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = N'PROC_FLOW_CARD')
    SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.yj_role_panel
            WHERE panel_code = N'PROC_FLOW_CARD' AND ISNULL(perms, N'') NOT LIKE N'%view%')
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation
                WHERE scope = N'panel' AND ref_key = N'工序流程追踪卡' AND locale = N'en')
    SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工序流程追踪卡自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'PROC_FLOW_CARD 就绪(2 表 + 5 索引 + 表/列中文注明 + 角色授权 + 面板/动作词译名)';
GO
