/* ═══════════════════════════════════════════════════════════════════════════
 * migrate-rd-extra-record-file-20261117.sql
 *
 * 「数据记录表」下新增面板:特殊数据记录表(RD_EXTRA_REC_FILE)
 *
 * 【用户口径 2026-11-17】
 *   「在数据记录表列下边使用设计库新设计一个面板,可以上传一些比较特殊的数据记录表进行保存,
 *    也可以点击预览这些文件,删除需要管理员审批,这个文件上传面板的形式由你来想,
 *    所有人只要能看这个面板就可以查看这些上传的数据记录表」。
 *   追问确认:① 全员可上传 ② 删除走**单独的「待审批删除」列表** ③ 面板名「特殊数据记录表」。
 *
 * 【形态】
 *   1 行 = 1 份上传的数据记录表文件;文件本体复用 yj_attachment(锚点=面板+文件编号+「文件」列),
 *   与「共享文件库」(RD_SHARE_FILE / yj_share_file)同一套做法 —— 不另造文件存储。
 *   删除**不走**引擎审批流:本表自带 del_state(空=正常 / PENDING=待审批删除),
 *   由前端「待审批删除」列表集中处理(通过=物理删,驳回=回到正常)。
 *
 * 【权限】查看=面板 view(query);上传=add(迁移种子默认授予全部角色 ⇒ 全员可传);
 *   提交删除申请=add(人人可申请);审批删除=管理员或该面板 can_approve + del。
 *
 * 幂等:重复执行安全(表/面板/授权/译名/注明均先判存在)。
 * ⚠ 两个账套都要执行(AGENTS.md 两账套纪律)。
 * ═══════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO

/* ── ① 表 ─────────────────────────────────────────────────────────────── */
IF OBJECT_ID('dbo.rd_extra_rec_file','U') IS NULL
BEGIN
  CREATE TABLE dbo.rd_extra_rec_file (
    id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [文件编号]    NVARCHAR(20)  NOT NULL,           -- XR00001 自增展示号
    [文件名称]    NVARCHAR(200) NOT NULL,           -- 展示名(默认取原文件名去扩展名)
    [分类]        NVARCHAR(50)  NULL,               -- 自由文本分类(测试记录/检验报告/其它…)
    [关键词]      NVARCHAR(200) NULL,
    [备注]        NVARCHAR(500) NULL,
    [上传人]      NVARCHAR(50)  NULL,
    [上传时间]    DATETIME2     NULL,
    /* 附件锚点列：AttachmentService 上传/删除附件后会把该锚点的文件名串**回写**到这里
       （syncHeadField 按 field_key 找 yj_field 登记 → 走表头分支 UPDATE [文件]）。
       ⚠ 这一列必须有 —— 缺了就是「列名 '文件' 无效」500（2026-11-17 实测踩过）。 */
    [文件]        NVARCHAR(2000) NULL,
    /* 删除审批(用户口径:删除需要管理员审批,单独一个「待审批删除」列表) */
    del_state     VARCHAR(10)   NULL,               -- NULL=正常 / PENDING=待审批删除
    del_req_by    NVARCHAR(50)  NULL,               -- 申请人
    del_req_at    DATETIME2     NULL,
    del_req_note  NVARCHAR(500) NULL,               -- 申请理由(可选)
    del_appr_by   NVARCHAR(50)  NULL,               -- 审批人
    del_appr_at   DATETIME2     NULL,
    del_appr_result NVARCHAR(20) NULL,              -- APPROVED / REJECTED
    asp_user1 NVARCHAR(50) NULL, asp_time1 DATETIME2 NULL,
    asp_user2 NVARCHAR(50) NULL, asp_time2 DATETIME2 NULL,
    asp_cancel CHAR(1) NULL
  );
  CREATE UNIQUE INDEX UX_rd_extra_rec_file_no ON dbo.rd_extra_rec_file([文件编号]);
  CREATE INDEX IX_rd_extra_rec_file_del ON dbo.rd_extra_rec_file(del_state);
END
GO

/* 表已存在但没有 [文件] 列时补上(附件回写锚点列,缺它上传会 500) */
IF COL_LENGTH('dbo.rd_extra_rec_file', '文件') IS NULL
  ALTER TABLE dbo.rd_extra_rec_file ADD [文件] NVARCHAR(2000) NULL;
GO
IF COL_LENGTH('dbo.rd_extra_rec_file', '文件') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.rd_extra_rec_file')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.rd_extra_rec_file'), '文件', 'ColumnId')
                  AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'附件文件名串(由附件服务回写,作锚点)', 'SCHEMA','dbo','TABLE','rd_extra_rec_file','COLUMN', N'文件';
GO

/* ── ② 中文注明(新建表必须写 MS_Description) ──────────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.rd_extra_rec_file') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'特殊数据记录表·上传文件登记(文件本体在 yj_attachment;删除需管理员审批,走 del_state 待审批列表)', 'SCHEMA','dbo','TABLE','rd_extra_rec_file';
GO
DECLARE @cols TABLE (col SYSNAME, des NVARCHAR(500));
INSERT INTO @cols VALUES
 (N'文件编号', N'展示编号(XR 前缀 + 序号)'),
 (N'文件名称', N'展示名(默认取原文件名去扩展名)'),
 (N'分类',      N'自由文本分类(测试记录/检验报告/其它)'),
 (N'关键词',    N'搜索关键词'),
 (N'备注',      N'备注'),
 (N'上传人',    N'上传人账号'),
 (N'上传时间',  N'上传时间'),
 (N'del_state', N'删除审批状态:空=正常 / PENDING=待审批删除'),
 (N'del_req_by',N'删除申请人'),
 (N'del_req_at',N'删除申请时间'),
 (N'del_req_note',N'删除申请理由'),
 (N'del_appr_by',N'删除审批人'),
 (N'del_appr_at',N'删除审批时间'),
 (N'del_appr_result',N'删除审批结果:APPROVED/REJECTED');
DECLARE @c SYSNAME, @d NVARCHAR(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, des FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                 WHERE major_id = OBJECT_ID('dbo.rd_extra_rec_file')
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.rd_extra_rec_file'), @c, 'ColumnId')
                   AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @d, 'SCHEMA','dbo','TABLE','rd_extra_rec_file','COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ── ③ 面板元数据(archive 模式,与共享文件库同构) ─────────────────────── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_EXTRA_REC_FILE')
  INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode,
                        line_table, head_table, group_col, pk_col, code_col, prefix, date_col,
                        page_size, detail_key, module_group)
  VALUES ('RD_EXTRA_REC_FILE', N'特殊数据记录表', 'Special Data Record Files', N'研发管理', 'archive',
          'rd_extra_rec_file', 'rd_extra_rec_file', N'文件编号', 'id', N'文件编号', NULL, N'上传时间',
          20, 'items', N'研发管理');
GO

/* ── ④ 面板字段元数据(列表列;place=query 进查询区) ─────────────────────── */
DECLARE @f TABLE (col NVARCHAR(100), label NVARCHAR(100), seq INT, place VARCHAR(20), width INT);
INSERT INTO @f VALUES
 (N'文件编号', N'文件编号', 10, 'query',  120),
 (N'文件名称', N'文件名称', 20, 'query',  260),
 (N'分类',     N'分类',     30, 'query',  120),
 (N'关键词',   N'关键词',   40, 'query',  180),
 (N'上传人',   N'上传人',   50, 'query',  100),
 (N'上传时间', N'上传时间', 60, 'query',  150),
 (N'备注',     N'备注',     70, 'query',  200);
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'RD_EXTRA_REC_FILE', col, label, N'文本', place, seq, width, 0, 0, 0, 1
FROM @f f
WHERE NOT EXISTS (SELECT 1 FROM yj_field y WHERE y.panel_code='RD_EXTRA_REC_FILE' AND y.col_name = f.col);

/* 「文件」列:附件锚点用的**隐藏**字段登记(place=detail)。
   ⚠ 必须有这一行 —— AttachmentService.syncHeadField 会按 field_key 找 yj_field 登记,
     找不到就走"表头附件"分支去 UPDATE 表头同名物理列;而本表物理列叫「文件名称」,
     UPDATE [文件] 会直接报"列名无效"。登记成 detail 后它走明细分支并因无行 id 而安全跳过。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_EXTRA_REC_FILE' AND col_name = N'文件')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES ('RD_EXTRA_REC_FILE', N'文件', N'文件', N'附件', 'detail', 900, 120, 1, 0, 1, 0);
GO

/* ── ⑤ 全员查看 + 全员上传(用户口径:全员可传,能看面板就能看文件) ──────── */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, 'RD_EXTRA_REC_FILE', 'N', N'view,query,add'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p WHERE p.role_id = r.id AND p.panel_code = 'RD_EXTRA_REC_FILE');
GO

/* ── ⑥ 译名(多语言强制规范:新增面板/字段必须同时给译名) ──────────────── */
DECLARE @t TABLE (sc VARCHAR(10), rk NVARCHAR(100), lc VARCHAR(5), tx NVARCHAR(200));
INSERT INTO @t VALUES
 ('panel', N'特殊数据记录表', 'en', N'Special Data Record Files'),
 ('field', N'文件编号',       'en', N'File No.'),
 ('field', N'文件名称',       'en', N'File Name'),
 ('field', N'分类',           'en', N'Category'),
 ('field', N'关键词',         'en', N'Keywords'),
 ('field', N'上传人',         'en', N'Uploaded By'),
 ('field', N'上传时间',       'en', N'Uploaded At'),
 ('field', N'备注',           'en', N'Remark');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.sc, t.rk, t.lc, t.tx, 'manual' FROM @t t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation y WHERE y.scope=t.sc AND y.ref_key=t.rk AND y.locale=t.lc);
GO

/* ── ⑦ 自检:表/面板/字段/授权 四项必须齐 ─────────────────────────────── */
DECLARE @ok INT = 1;
IF OBJECT_ID('dbo.rd_extra_rec_file','U') IS NULL BEGIN PRINT '[FAIL] 表 rd_extra_rec_file 未建'; SET @ok = 0; END
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_EXTRA_REC_FILE') BEGIN PRINT '[FAIL] yj_panel 未登记'; SET @ok = 0; END
DECLARE @nf INT = (SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_EXTRA_REC_FILE');
IF @nf = 0 BEGIN PRINT '[FAIL] yj_field 无字段行'; SET @ok = 0; END
DECLARE @nr INT = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code='RD_EXTRA_REC_FILE');
IF @nr = 0 BEGIN PRINT '[FAIL] yj_role_panel 无授权行'; SET @ok = 0; END
IF @ok = 1 PRINT '[PASS] RD_EXTRA_REC_FILE 迁移完成(字段 ' + CAST(@nf AS VARCHAR) + ' 行,授权 ' + CAST(@nr AS VARCHAR) + ' 个角色)';
GO
