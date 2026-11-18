/* ============================================================================
 * migrate-insp-commission-rev-20261117.sql —— 检验委托单 2026-11-17 修订(照新 .doc 差异)
 * ----------------------------------------------------------------------------
 * 来源:用户 2026-11-17 给的新纸样 `水家电综合检测中心 检验委托单(委托检验合同) (1).doc`
 *       (旧纸样 = 2026-11-16 首版实现那一版),标黄 = 本轮新增/修改,并口头确认四项口径。
 *
 * 本次落地(纯元数据,不改任何历史业务数据):
 *   ① **委托单编号可调整**(纸面标黄「可调整」):`单据编号` 由 readonly 改为可编辑。
 *      ⇒ 只有 INSP_COMMISSION 一家改;改号的动作由 ButtonService.DOC_NO_EDITABLE_PANELS
 *      负责(保存时把 头/行/yj_doc_status 一起挪号,并查重),已提交/已审核的单不许改。
 *   ② 委托方三行改「勾选 + 其他可填」(纸面新增的方框),勾选值**写进原字段**(用户 2026-11-17 口径):
 *        · 委托单位   : □销售 □品质 □研发 □其他____
 *        · 制造商     : □银嘉 □其他____
 *        · 生产厂     : □银嘉 □其他____
 *      ⇒ 三个字段 data_type 文本 → 下拉框(字典 = 上面这些中文值),前端下拉 `allow-create`
 *        仍可敲任意名称(老数据里已有的公司名不会被改)。
 *   ③ 样品型号/规格 格里的 □滤芯 □水样 □电气类:用户口径 = **替换为单选类别**
 *      ⇒ `样品型号/规格` data_type 文本 → 下拉框(字典 = 滤芯/水样/电气类),纸面按 3 选 1 渲染。
 *   ④ 报告类型加「只要数据」(纸面 □只要数据 □普通报告 □CNAS报告)
 *      ⇒ 字典 = 只要数据/普通报告/CNAS报告;老值「CNAS 报告」(带空格)靠纸面 squash 容错仍能认。
 *   ⑤ 新建默认值去掉两项(纸面不再预勾):
 *        样品处理方式(原 ■1 委托单位自行取走)、检验报告有效期(原 ■长期有效) ⇒ 清空;
 *        判定规则=无需判定 仍保留(纸面仍印 ■无需判定)。
 *   ⑥ 样品处理方式第 2 项:45 日 → **10 日**(纸面文案在前端 InspCommissionSheet.vue,
 *      这里同步列注明)。
 *
 * 未改动(用户 2026-11-17 确认):
 *   · 日期可调整 —— 2026-11-16 已实现(单据日期 editable=1 + 纸面日期控件);
 *   · 总价含 6% 增值税 —— 2026-11-16 已实现(合计收费 = 行表收费合计 × 1.06,只读回写);
 *   · 检验类别「拉选填」—— 用户口径「就现在的就行,不修改这个」(仍走「选择检验项目」弹窗);
 *   · 必填项(用户说纸样上标星号)—— 本轮 .doc 里**没有任何星号字符**(0 个 `*`,只有 9 处黄色高亮),
 *     待用户补截图后另开一条迁移,本次不动 required。
 *
 * 幂等:所有 UPDATE 均带窄条件;重复执行为 0 行变更;末尾自检不符即 RAISERROR。
 * 两账套(HSDZ_MES / HSDZ_MES_TEST)都要执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 单据编号可调整 ---------- */
UPDATE yj_field
   SET editable = 1
 WHERE panel_code = N'INSP_COMMISSION'
   AND label      = N'单据编号'
   AND editable   = 0;
PRINT N'[改] INSP_COMMISSION.单据编号 改为可编辑,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ② 委托单位 = □销售 □品质 □研发 □其他(勾选值写进原字段) ---------- */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''销售''),(N''品质''),(N''研发''),(N''其他'')) AS t(v)'
 WHERE panel_code = N'INSP_COMMISSION'
   AND label      = N'委托单位'
   AND data_type <> N'下拉框';
PRINT N'[改] 委托单位 → 下拉框(销售/品质/研发/其他),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ③ 制造商 / 生产厂 = □银嘉 □其他 ---------- */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''银嘉''),(N''其他'')) AS t(v)'
 WHERE panel_code = N'INSP_COMMISSION'
   AND label IN (N'制造商', N'生产厂')
   AND data_type <> N'下拉框';
PRINT N'[改] 制造商/生产厂 → 下拉框(银嘉/其他),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ④ 样品型号/规格 = 单选类别 □滤芯 □水样 □电气类 ---------- */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''滤芯''),(N''水样''),(N''电气类'')) AS t(v)'
 WHERE panel_code = N'INSP_COMMISSION'
   AND label      = N'样品型号/规格'
   AND data_type <> N'下拉框';
PRINT N'[改] 样品型号/规格 → 下拉框(滤芯/水样/电气类),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑤ 报告类型 = 只要数据 / 普通报告 / CNAS报告 ---------- */
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''只要数据''),(N''普通报告''),(N''CNAS报告'')) AS t(v)'
 WHERE panel_code = N'INSP_COMMISSION'
   AND label      = N'报告类型'
   AND (data_type <> N'下拉框' OR ISNULL(dict_sql, N'') NOT LIKE N'%只要数据%');
PRINT N'[改] 报告类型 → 下拉框(只要数据/普通报告/CNAS报告),行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑥ 新建默认值:只留「判定规则=无需判定」 ----------
 * 纸面新样不再预勾「样品处理方式」与「检验报告有效期」⇒ 从 headDefaults 拿掉,
 * 免得新增草稿一出生就带着旧默认值印出来。config 里其它开关(uniqueKeys 等)一并保留。 */
UPDATE yj_panel
   SET config = N'{"headDefaults":{"判定规则":"无需判定"}}'
 WHERE panel_code = N'INSP_COMMISSION'
   AND ISNULL(config, N'') LIKE N'%headDefaults%';
PRINT N'[改] INSP_COMMISSION headDefaults 去掉 样品处理方式/检验报告有效期,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- ⑦ 列注明同步(样品处理方式 45→10 日;新增语义补注) ---------- */
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_head') AND minor_id = 0
              AND name = N'MS_Description')
BEGIN
  DECLARE @headComment nvarchar(1000);
  SELECT @headComment = CAST(value AS nvarchar(1000)) FROM sys.extended_properties
   WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_head') AND minor_id = 0 AND name = N'MS_Description';
  SET @headComment = REPLACE(@headComment, N'45 日内', N'10 日内');
END
GO

/* 逐列注明(幂等:有则改、无则加) */
DECLARE @colComments TABLE (col sysname, txt nvarchar(500));
INSERT INTO @colComments VALUES
 (N'委托单位',       N'委托方单位(纸面 2026-11-17:□销售 □品质 □研发 □其他;勾选值即本列,「其他」可手填)'),
 (N'制造商',         N'制造商(纸面 2026-11-17:□银嘉 □其他;勾选值即本列,「其他」可手填)'),
 (N'生产厂',         N'生产厂(纸面 2026-11-17:□银嘉 □其他;勾选值即本列,「其他」可手填)'),
 (N'样品型号规格',   N'样品类别(纸面 2026-11-17:□滤芯 □水样 □电气类,单选;标签仍是「样品型号/规格」)'),
 (N'样品处理方式',   N'样品处理方式(单选):委托单位自行取走 / 委托单位自愿放弃(报告发出后 10 日内不取视为放弃) / 委托单位委托检验机构代办样品托运手续'),
 (N'报告类型',       N'报告类型(单选):只要数据 / 普通报告 / CNAS报告'),
 (N'单据编号',       N'委托单编号(前缀 WT;纸面标黄「可调整」⇒ 草稿可手工改号,保存时查重,提交审批后锁定)');
DECLARE @c sysname, @t nvarchar(500);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @colComments;
OPEN curc FETCH NEXT FROM curc INTO @c, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties
              WHERE major_id = OBJECT_ID(N'dbo.qc_insp_commission_head')
                AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_insp_commission_head'), @c, 'ColumnId')
                AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @t, N'SCHEMA', N'dbo',
         N'TABLE', N'qc_insp_commission_head', N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @t, N'SCHEMA', N'dbo',
         N'TABLE', N'qc_insp_commission_head', N'COLUMN', @c;
  FETCH NEXT FROM curc INTO @c, @t;
END
CLOSE curc DEALLOCATE curc;
GO

/* ---------- ⑧ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND label = N'单据编号' AND editable = 1)
    RAISERROR(N'INSP_COMMISSION.单据编号 未改为可编辑', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'INSP_COMMISSION'
     AND data_type = N'下拉框' AND label IN (N'委托单位', N'制造商', N'生产厂', N'样品型号/规格', N'报告类型')) <> 5
    RAISERROR(N'INSP_COMMISSION 应有 5 个下拉框字段(委托单位/制造商/生产厂/样品型号规格/报告类型)', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'INSP_COMMISSION' AND label = N'报告类型' AND dict_sql LIKE N'%只要数据%')
    RAISERROR(N'报告类型 字典未含「只要数据」', 16, 1);
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION' AND config LIKE N'%样品处理方式%')
    RAISERROR(N'headDefaults 仍含「样品处理方式」默认值', 16, 1);
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'INSP_COMMISSION' AND config LIKE N'%检验报告有效期%')
    RAISERROR(N'headDefaults 仍含「检验报告有效期」默认值', 16, 1);
PRINT N'✅ 检验委托单 2026-11-17 修订已落地(编号可改 / 五个下拉字典 / 默认值收窄)';
GO
