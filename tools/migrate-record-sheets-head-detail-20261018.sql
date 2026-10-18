/* migrate-record-sheets-head-detail-20261018.sql(2026-10-18)
 *
 * 目的:把三张「记录表」由「整张表头」改成「表头 + 明细」—— 用户口径
 *   「可以新增但是没有看到明细表」,纸面单据(r6_image5 造粒记录表 / r23_image22 无黑处理登记表 /
 *   r25_image24 封箱前数量确认表)本来就是**一行一条记录**的台账,而这三个面板此前把所有业务
 *   字段都登记成 place=header ⇒ 表单的「明细」页签 0 列(点「新增数据」只出一行空白)、
 *   列表页明细区(A 区)整块不渲染。
 *
 * 改法(与 生产日报表/投料确认单/设备点检 EQUIP_CHECK 同构):
 *   表头只留 单据编号 / 单据日期(封箱=装箱日期) / 单据状态 / 审核人 / 备注;
 *   其余业务字段全部下放到明细表(一行一条记录),明细表补同名同类型物理列。
 *
 *   面板                        表头保留                              明细(下放)
 *   GRAN_RECORD  造粒记录        单据编号/单据日期/单据状态/审核人/备注   物料名称/生产批次/ZHP_C批次/ZG_C批次/活性粉/温度/湿度/
 *                                                                       PE用量/纯水用量/捏合时间/吹扫时间/测试时间/水分含量/
 *                                                                       取样测试人/操作员            (15)
 *   WH_RECORD    无黑处理登记    单据编号/单据日期/单据状态/审核人/备注   成型日期/产品编号/尺寸/加湿前重量/加湿后重量/无黑时间/取样时间 (7)
 *   PACK_CONFIRM 封箱确认        单据编号/装箱日期/单据状态/审核人/备注   产品编号/装箱数量/装箱人/确认人/主管签名                 (5)
 *
 * 顺带:① 三张明细表补列(类型照抄头表当前定义,全部可空)+ 列级中文注明;
 *      ② 头表里这些业务列已无数据(造粒/封箱 0 单、无黑 2 张空草稿)、且无任何视图/过程/索引/
 *         默认值/检查约束引用(sys.sql_expression_dependencies = 0、索引/默认/check/计算列 = 0),
 *         故同批 DROP,避免与明细表同名列长期并存;
 *      ③ 无黑处理登记现有 2 张**空草稿**(WB-2026-10-0001/0002,业务列全 NULL,是本轮排障时
 *         手工点出来的测试单)一并清掉(头行 + yj_doc_status),重录后即为真单据;
 *         守卫:只在「这几列还在、且确实全空」时才删 —— 脚本重跑/服务器上已有真实数据时一律不删。
 *
 * 幂等:补列 COL_LENGTH 守卫、说明 NOT EXISTS 守卫、改 place 只动 header 行、DROP 前判列在、
 *       删单只删指定单号且必须全空 ⇒ 重跑「执行 0 行」。
 * 自检:① 27 个明细列齐;② 三个面板表头恰好 5 个字段;③ 头表业务列已不存在。
 * 两账套均执行(先正式、后测试)。
 */

/* ── 1. 明细表补业务列(照抄头表类型) ───────────────────────────────── */
IF COL_LENGTH(N'dbo.gran_record_detail', N'物料名称') IS NULL ALTER TABLE dbo.gran_record_detail ADD [物料名称] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'生产批次') IS NULL ALTER TABLE dbo.gran_record_detail ADD [生产批次] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'ZHP_C批次') IS NULL ALTER TABLE dbo.gran_record_detail ADD [ZHP_C批次] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'ZG_C批次') IS NULL ALTER TABLE dbo.gran_record_detail ADD [ZG_C批次] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'活性粉') IS NULL ALTER TABLE dbo.gran_record_detail ADD [活性粉] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'温度') IS NULL ALTER TABLE dbo.gran_record_detail ADD [温度] decimal(18,2) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'湿度') IS NULL ALTER TABLE dbo.gran_record_detail ADD [湿度] decimal(18,2) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'PE用量') IS NULL ALTER TABLE dbo.gran_record_detail ADD [PE用量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'纯水用量') IS NULL ALTER TABLE dbo.gran_record_detail ADD [纯水用量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'捏合时间') IS NULL ALTER TABLE dbo.gran_record_detail ADD [捏合时间] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'吹扫时间') IS NULL ALTER TABLE dbo.gran_record_detail ADD [吹扫时间] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'测试时间') IS NULL ALTER TABLE dbo.gran_record_detail ADD [测试时间] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'水分含量') IS NULL ALTER TABLE dbo.gran_record_detail ADD [水分含量] decimal(18,2) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'取样测试人') IS NULL ALTER TABLE dbo.gran_record_detail ADD [取样测试人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.gran_record_detail', N'操作员') IS NULL ALTER TABLE dbo.gran_record_detail ADD [操作员] nvarchar(50) NULL;

IF COL_LENGTH(N'dbo.wh_record_detail', N'成型日期') IS NULL ALTER TABLE dbo.wh_record_detail ADD [成型日期] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'产品编号') IS NULL ALTER TABLE dbo.wh_record_detail ADD [产品编号] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'尺寸') IS NULL ALTER TABLE dbo.wh_record_detail ADD [尺寸] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'加湿前重量') IS NULL ALTER TABLE dbo.wh_record_detail ADD [加湿前重量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'加湿后重量') IS NULL ALTER TABLE dbo.wh_record_detail ADD [加湿后重量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'无黑时间') IS NULL ALTER TABLE dbo.wh_record_detail ADD [无黑时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.wh_record_detail', N'取样时间') IS NULL ALTER TABLE dbo.wh_record_detail ADD [取样时间] nvarchar(20) NULL;

IF COL_LENGTH(N'dbo.pack_confirm_detail', N'产品编号') IS NULL ALTER TABLE dbo.pack_confirm_detail ADD [产品编号] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.pack_confirm_detail', N'装箱数量') IS NULL ALTER TABLE dbo.pack_confirm_detail ADD [装箱数量] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.pack_confirm_detail', N'装箱人') IS NULL ALTER TABLE dbo.pack_confirm_detail ADD [装箱人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.pack_confirm_detail', N'确认人') IS NULL ALTER TABLE dbo.pack_confirm_detail ADD [确认人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.pack_confirm_detail', N'主管签名') IS NULL ALTER TABLE dbo.pack_confirm_detail ADD [主管签名] nvarchar(50) NULL;
GO

/* ── 2. 新列中文注明(表/列);已有注明不覆盖 ─────────────────────────── */
DECLARE @t sysname, @c sysname, @d nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
SELECT * FROM (VALUES
 (N'gran_record_detail', N'物料名称',   N'造粒记录行:物料名称'),
 (N'gran_record_detail', N'生产批次',   N'造粒记录行:生产批次'),
 (N'gran_record_detail', N'ZHP_C批次',  N'造粒记录行:Z-HP-C 批次'),
 (N'gran_record_detail', N'ZG_C批次',   N'造粒记录行:Z-G-C 批次'),
 (N'gran_record_detail', N'活性粉',     N'造粒记录行:活性粉'),
 (N'gran_record_detail', N'温度',       N'造粒记录行:温度/℃'),
 (N'gran_record_detail', N'湿度',       N'造粒记录行:湿度/%'),
 (N'gran_record_detail', N'PE用量',     N'造粒记录行:P-E 用量/kg'),
 (N'gran_record_detail', N'纯水用量',   N'造粒记录行:纯水用量/kg'),
 (N'gran_record_detail', N'捏合时间',   N'造粒记录行:捏合时间'),
 (N'gran_record_detail', N'吹扫时间',   N'造粒记录行:吹扫时间'),
 (N'gran_record_detail', N'测试时间',   N'造粒记录行:测试时间'),
 (N'gran_record_detail', N'水分含量',   N'造粒记录行:水分含量/%'),
 (N'gran_record_detail', N'取样测试人', N'造粒记录行:取样测试人'),
 (N'gran_record_detail', N'操作员',     N'造粒记录行:操作员'),
 (N'wh_record_detail',   N'成型日期',   N'无黑处理行:成型日期'),
 (N'wh_record_detail',   N'产品编号',   N'无黑处理行:产品编号'),
 (N'wh_record_detail',   N'尺寸',       N'无黑处理行:尺寸'),
 (N'wh_record_detail',   N'加湿前重量', N'无黑处理行:加湿前重量'),
 (N'wh_record_detail',   N'加湿后重量', N'无黑处理行:加湿后重量'),
 (N'wh_record_detail',   N'无黑时间',   N'无黑处理行:无黑处理时长/起止'),
 (N'wh_record_detail',   N'取样时间',   N'无黑处理行:取样时间'),
 (N'pack_confirm_detail', N'产品编号',  N'封箱确认行:产品编号'),
 (N'pack_confirm_detail', N'装箱数量',  N'封箱确认行:装箱数量'),
 (N'pack_confirm_detail', N'装箱人',    N'封箱确认行:装箱人'),
 (N'pack_confirm_detail', N'确认人',    N'封箱确认行:确认人'),
 (N'pack_confirm_detail', N'主管签名',  N'封箱确认行:主管签名')
) v(t, c, d);
OPEN cur; FETCH NEXT FROM cur INTO @t, @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t, @c) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                       WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.' + @t)
                         AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @c, 'ColumnId')
                         AND name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @t, @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ── 3. 字段位次:业务字段 header → detail(query 位保留) ─────────────── */
UPDATE yj_field SET place = REPLACE(place, N'header', N'detail')
WHERE panel_code = N'GRAN_RECORD'
  AND col_name IN (N'物料名称', N'生产批次', N'ZHP_C批次', N'ZG_C批次', N'活性粉', N'温度', N'湿度',
                   N'PE用量', N'纯水用量', N'捏合时间', N'吹扫时间', N'测试时间', N'水分含量',
                   N'取样测试人', N'操作员')
  AND place LIKE N'%header%' AND place NOT LIKE N'%detail%';

UPDATE yj_field SET place = REPLACE(place, N'header', N'detail')
WHERE panel_code = N'WH_RECORD'
  AND col_name IN (N'成型日期', N'产品编号', N'尺寸', N'加湿前重量', N'加湿后重量', N'无黑时间', N'取样时间')
  AND place LIKE N'%header%' AND place NOT LIKE N'%detail%';

UPDATE yj_field SET place = REPLACE(place, N'header', N'detail')
WHERE panel_code = N'PACK_CONFIRM'
  AND col_name IN (N'产品编号', N'装箱数量', N'装箱人', N'确认人', N'主管签名')
  AND place LIKE N'%header%' AND place NOT LIKE N'%detail%';
GO

/* ── 4. 清掉本轮排障时点出的 2 张空草稿(只删「指定单号 + 业务列全空」) ── */
IF COL_LENGTH(N'dbo.wh_record', N'产品编号') IS NOT NULL
BEGIN
    DELETE FROM yj_doc_status
    WHERE panel_code = N'WH_RECORD'
      AND doc_no IN (N'WB-2026-10-0001', N'WB-2026-10-0002')
      AND EXISTS (SELECT 1 FROM dbo.wh_record r
                  WHERE r.[单据编号] = yj_doc_status.doc_no
                    AND r.[产品编号] IS NULL AND r.[尺寸] IS NULL AND r.[成型日期] IS NULL
                    AND r.[加湿前重量] IS NULL AND r.[加湿后重量] IS NULL
                    AND r.[无黑时间] IS NULL AND r.[取样时间] IS NULL);

    DELETE r FROM dbo.wh_record r
    WHERE r.[单据编号] IN (N'WB-2026-10-0001', N'WB-2026-10-0002')
      AND r.[产品编号] IS NULL AND r.[尺寸] IS NULL AND r.[成型日期] IS NULL
      AND r.[加湿前重量] IS NULL AND r.[加湿后重量] IS NULL
      AND r.[无黑时间] IS NULL AND r.[取样时间] IS NULL;
END
GO

/* ── 5. 头表业务列下沉后 DROP(已无数据、无索引/默认/约束/模块引用) ───── */
IF COL_LENGTH(N'dbo.gran_record', N'物料名称') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [物料名称];
IF COL_LENGTH(N'dbo.gran_record', N'生产批次') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [生产批次];
IF COL_LENGTH(N'dbo.gran_record', N'ZHP_C批次') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [ZHP_C批次];
IF COL_LENGTH(N'dbo.gran_record', N'ZG_C批次') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [ZG_C批次];
IF COL_LENGTH(N'dbo.gran_record', N'活性粉') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [活性粉];
IF COL_LENGTH(N'dbo.gran_record', N'温度') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [温度];
IF COL_LENGTH(N'dbo.gran_record', N'湿度') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [湿度];
IF COL_LENGTH(N'dbo.gran_record', N'PE用量') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [PE用量];
IF COL_LENGTH(N'dbo.gran_record', N'纯水用量') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [纯水用量];
IF COL_LENGTH(N'dbo.gran_record', N'捏合时间') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [捏合时间];
IF COL_LENGTH(N'dbo.gran_record', N'吹扫时间') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [吹扫时间];
IF COL_LENGTH(N'dbo.gran_record', N'测试时间') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [测试时间];
IF COL_LENGTH(N'dbo.gran_record', N'水分含量') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [水分含量];
IF COL_LENGTH(N'dbo.gran_record', N'取样测试人') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [取样测试人];
IF COL_LENGTH(N'dbo.gran_record', N'操作员') IS NOT NULL ALTER TABLE dbo.gran_record DROP COLUMN [操作员];

IF COL_LENGTH(N'dbo.wh_record', N'成型日期') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [成型日期];
IF COL_LENGTH(N'dbo.wh_record', N'产品编号') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [产品编号];
IF COL_LENGTH(N'dbo.wh_record', N'尺寸') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [尺寸];
IF COL_LENGTH(N'dbo.wh_record', N'加湿前重量') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [加湿前重量];
IF COL_LENGTH(N'dbo.wh_record', N'加湿后重量') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [加湿后重量];
IF COL_LENGTH(N'dbo.wh_record', N'无黑时间') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [无黑时间];
IF COL_LENGTH(N'dbo.wh_record', N'取样时间') IS NOT NULL ALTER TABLE dbo.wh_record DROP COLUMN [取样时间];

IF COL_LENGTH(N'dbo.pack_confirm', N'产品编号') IS NOT NULL ALTER TABLE dbo.pack_confirm DROP COLUMN [产品编号];
IF COL_LENGTH(N'dbo.pack_confirm', N'装箱数量') IS NOT NULL ALTER TABLE dbo.pack_confirm DROP COLUMN [装箱数量];
IF COL_LENGTH(N'dbo.pack_confirm', N'装箱人') IS NOT NULL ALTER TABLE dbo.pack_confirm DROP COLUMN [装箱人];
IF COL_LENGTH(N'dbo.pack_confirm', N'确认人') IS NOT NULL ALTER TABLE dbo.pack_confirm DROP COLUMN [确认人];
IF COL_LENGTH(N'dbo.pack_confirm', N'主管签名') IS NOT NULL ALTER TABLE dbo.pack_confirm DROP COLUMN [主管签名];
GO

/* ── 6. 自检 ─────────────────────────────────────────────────────────── */
DECLARE @miss nvarchar(max) = N'';
SELECT @miss = @miss + v.t + N'.' + v.c + N';'
FROM (VALUES
 (N'gran_record_detail', N'物料名称'), (N'gran_record_detail', N'生产批次'), (N'gran_record_detail', N'ZHP_C批次'),
 (N'gran_record_detail', N'ZG_C批次'), (N'gran_record_detail', N'活性粉'), (N'gran_record_detail', N'温度'),
 (N'gran_record_detail', N'湿度'), (N'gran_record_detail', N'PE用量'), (N'gran_record_detail', N'纯水用量'),
 (N'gran_record_detail', N'捏合时间'), (N'gran_record_detail', N'吹扫时间'), (N'gran_record_detail', N'测试时间'),
 (N'gran_record_detail', N'水分含量'), (N'gran_record_detail', N'取样测试人'), (N'gran_record_detail', N'操作员'),
 (N'wh_record_detail', N'成型日期'), (N'wh_record_detail', N'产品编号'), (N'wh_record_detail', N'尺寸'),
 (N'wh_record_detail', N'加湿前重量'), (N'wh_record_detail', N'加湿后重量'), (N'wh_record_detail', N'无黑时间'),
 (N'wh_record_detail', N'取样时间'),
 (N'pack_confirm_detail', N'产品编号'), (N'pack_confirm_detail', N'装箱数量'), (N'pack_confirm_detail', N'装箱人'),
 (N'pack_confirm_detail', N'确认人'), (N'pack_confirm_detail', N'主管签名')
) v(t, c)
WHERE COL_LENGTH(N'dbo.' + v.t, v.c) IS NULL;
IF LEN(@miss) > 0 RAISERROR(N'[record-sheets] 自检失败:明细列缺失', 16, 1);

DECLARE @hdr int;
SELECT @hdr = COUNT(*) FROM yj_field
WHERE panel_code = N'GRAN_RECORD' AND place LIKE N'%header%';
IF @hdr <> 5 RAISERROR(N'[record-sheets] 自检失败:GRAN_RECORD 表头字段数应为 5', 16, 1);
SELECT @hdr = COUNT(*) FROM yj_field
WHERE panel_code = N'WH_RECORD' AND place LIKE N'%header%';
IF @hdr <> 5 RAISERROR(N'[record-sheets] 自检失败:WH_RECORD 表头字段数应为 5', 16, 1);
SELECT @hdr = COUNT(*) FROM yj_field
WHERE panel_code = N'PACK_CONFIRM' AND place LIKE N'%header%';
IF @hdr <> 5 RAISERROR(N'[record-sheets] 自检失败:PACK_CONFIRM 表头字段数应为 5', 16, 1);

IF COL_LENGTH(N'dbo.gran_record', N'物料名称') IS NOT NULL
   OR COL_LENGTH(N'dbo.wh_record', N'产品编号') IS NOT NULL
   OR COL_LENGTH(N'dbo.pack_confirm', N'产品编号') IS NOT NULL
    RAISERROR(N'[record-sheets] 自检失败:头表业务列未清理', 16, 1);

PRINT N'[record-sheets] 完成:三个面板已改为 表头(5) + 明细(15/7/5),头表业务列已下沉';
GO

/* ── 7. 表级中文注明改写(原「占位行表(恒空,doc模式要求)」已不符合现状) ── */
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.gran_record_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'造粒记录明细表(一行一条造粒记录:物料/批次/温湿度/PE/纯水/捏合吹扫/水分/操作员)', N'SCHEMA', N'dbo', N'TABLE', N'gran_record_detail';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'造粒记录明细表(一行一条造粒记录:物料/批次/温湿度/PE/纯水/捏合吹扫/水分/操作员)', N'SCHEMA', N'dbo', N'TABLE', N'gran_record_detail';

IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wh_record_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'无黑处理登记明细表(一行一条:成型日期/产品编号/尺寸/加湿前后重量/无黑时间/取样时间)', N'SCHEMA', N'dbo', N'TABLE', N'wh_record_detail';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'无黑处理登记明细表(一行一条:成型日期/产品编号/尺寸/加湿前后重量/无黑时间/取样时间)', N'SCHEMA', N'dbo', N'TABLE', N'wh_record_detail';

IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.pack_confirm_detail') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'封箱确认明细表(一行一条:产品编号/装箱数量/装箱人/确认人/主管签名)', N'SCHEMA', N'dbo', N'TABLE', N'pack_confirm_detail';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'封箱确认明细表(一行一条:产品编号/装箱数量/装箱人/确认人/主管签名)', N'SCHEMA', N'dbo', N'TABLE', N'pack_confirm_detail';

IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.gran_record') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'造粒记录单据头(单据编号/单据日期/状态/审核人;记录内容见 gran_record_detail)', N'SCHEMA', N'dbo', N'TABLE', N'gran_record';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wh_record') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'无黑处理登记单据头(单据编号/单据日期/状态/审核人;记录内容见 wh_record_detail)', N'SCHEMA', N'dbo', N'TABLE', N'wh_record';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.pack_confirm') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'封箱确认单据头(单据编号/装箱日期/状态/审核人;记录内容见 pack_confirm_detail)', N'SCHEMA', N'dbo', N'TABLE', N'pack_confirm';
GO
