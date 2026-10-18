-- migrate-proc-process-samples-20261018.sql — 「生产过程」空白单据补样例数据(2026-10-18)
--
-- 【用户口径】2026-10-18「有一些单据还是空的」。体检实测(tools/archive/_prod-process-audit/_PanelAudit.java):
--   生产日报表 / 投料确认单 / 物料混合记录 / 造粒记录 / 无黑处理登记 / 封箱确认 / 生产异常处理单
--   七张单据的头表 **全 0 行** ⇒ 打开就是「第 0/0 张」空白表单,连一条可参照的记录都没有。
--
-- 【做法】每张单据各铺 1 张**格式真实**的样例单据(头 + 明细),字段值全部取自库里真实档案:
--   产品/物料 A-32-01「S阻垢炭棒/滤芯」← bs_inv;人员 张伟/李娜/王芳 ← bs_emp;
--   工序 OP-CX「成型」← bs_op;工单 GD2608260013 + 批次 20260826 ← plang。
--   状态一律 `草稿` —— 审核留给走流程,不在这里预置「已审核」。
--
-- 【顺带修的脏数据】feed_confirm_detail / mix_record_detail 各有 1 行**孤儿明细**
--   (单号 TR-2026-09-0001 / HH-2026-09-0001,是当初「新增单据」预插的空行、单据头没保存)。
--   这里**不删除**,而是把对应单据头补上、空行补上内容 ⇒ 孤儿变成有效单据(用户可见)。
--
-- 幂等:全部按「单据编号不存在才插入」判断,可重复执行。
-- ⚠ 这是**样例数据**:全量恢复到服务器之前,必须按本脚本末尾的清理语句清掉(正式库只录真实业务)。

SET NOCOUNT ON;

DECLARE @u nvarchar(50) = N'sample-20261018';
DECLARE @t nvarchar(30) = CONVERT(nvarchar(30), GETDATE(), 120);
DECLARE @made int = 0;

/* ═══ 1. 生产日报表 RB-2026-10-0001(成型车间一个班次) ═══ */
IF NOT EXISTS (SELECT 1 FROM day_report WHERE 单据编号 = N'RB-2026-10-0001')
BEGIN
    INSERT INTO day_report (单据编号, 单据日期, 车间, 出勤人数, 填表人, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'RB-2026-10-0001', N'2026-10-18', N'成型车间', 12, N'张伟', N'成型段白班生产日报', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM day_report_detail WHERE 单据编号 = N'RB-2026-10-0001')
BEGIN
    INSERT INTO day_report_detail (单据编号, 姓名, 时间, 产品编码, 产品名称, 规格, 单位, 数量, 工作内容, 灌料重每支, 物料总用量, 报废, 料头料尾重量, 工序内容, 合格数量, 损失时间, 原因, asp_user1, asp_time1, asp_cancel)
    VALUES
      (N'RB-2026-10-0001', N'李娜', N'2026-10-18', N'A-32-01', N'S阻垢炭棒/滤芯', N'φ32×120', N'支', 1200, N'成型', 42.5000, 51000.0000, 12, 8.5000, N'成型', 1188, N'0.5h', N'换模', @u, @t, 'N'),
      (N'RB-2026-10-0001', N'王芳', N'2026-10-18', N'A-32-01', N'S阻垢炭棒/滤芯', N'φ32×120', N'支', 1150, N'成型', 42.0000, 48300.0000, 8, 7.0000, N'成型', 1142, N'-', N'-', @u, @t, 'N');
END

/* ═══ 2. 投料确认单 TR-2026-10-0001 ═══ */
IF NOT EXISTS (SELECT 1 FROM feed_confirm WHERE 单据编号 = N'TR-2026-10-0001')
BEGIN
    INSERT INTO feed_confirm (单据编号, 单据日期, 物料名称, 批号, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'TR-2026-10-0001', N'2026-10-18', N'S阻垢炭棒/滤芯', N'20261018', N'阻垢粉体线投料', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM feed_confirm_detail WHERE 单据编号 = N'TR-2026-10-0001')
BEGIN
    INSERT INTO feed_confirm_detail (单据编号, 投料成分, 阶段, 理论数量, 实际重量, 投料人, 是否确认, 确认人, asp_user1, asp_time1, asp_cancel)
    VALUES
      (N'TR-2026-10-0001', N'活性炭粉', N'溶解', 500.0000, 498.6000, N'张伟', N'是', N'李娜', @u, @t, 'N'),
      (N'TR-2026-10-0001', N'纯水',     N'合成', 200.0000, 201.2000, N'李娜', N'是', N'王芳', @u, @t, 'N');
END

/* ═══ 3. 物料混合记录 HH-2026-10-0001 ═══ */
IF NOT EXISTS (SELECT 1 FROM mix_record WHERE 单据编号 = N'HH-2026-10-0001')
BEGIN
    INSERT INTO mix_record (单据编号, 单据日期, 物料编码, 物料名称, 生产批次, 操作人, 核对人, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'HH-2026-10-0001', N'2026-10-18', N'A-32-01', N'S阻垢炭棒/滤芯', N'20261018', N'张伟', N'李娜', N'二次混合', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM mix_record_detail WHERE 单据编号 = N'HH-2026-10-0001')
BEGIN
    INSERT INTO mix_record_detail (单据编号, 混合次序, 投料时间, 物料单批次, 重量, 混合时间, asp_user1, asp_time1, asp_cancel)
    VALUES
      (N'HH-2026-10-0001', N'第一次', N'2026-10-18 08:30', N'20261018', 250.0000, 15.00, @u, @t, 'N'),
      (N'HH-2026-10-0001', N'第二次', N'2026-10-18 09:00', N'20261018', 248.5000, 20.00, @u, @t, 'N');
END

/* ═══ 4. 造粒记录 LZ-2026-10-0001(头 + 明细:工艺参数在 gran_record_detail) ═══ */
IF NOT EXISTS (SELECT 1 FROM gran_record WHERE 单据编号 = N'LZ-2026-10-0001')
BEGIN
    INSERT INTO gran_record (单据编号, 单据日期, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'LZ-2026-10-0001', N'2026-10-18', N'造粒过程参数记录', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM gran_record_detail WHERE 单据编号 = N'LZ-2026-10-0001')
BEGIN
    INSERT INTO gran_record_detail (单据编号, 物料名称, 生产批次, ZHP_C批次, ZG_C批次, 活性粉, 温度, 湿度,
                                    PE用量, 纯水用量, 捏合时间, 吹扫时间, 测试时间, 水分含量, 取样测试人, 操作员,
                                    asp_user1, asp_time1, asp_cancel)
    VALUES (N'LZ-2026-10-0001', N'S阻垢炭棒/滤芯', N'20261018', N'ZHP-20261018', N'ZG-20261018',
            N'活性炭粉A', 85.50, 45.00, 12.5000, 200.0000, N'25分钟', N'10分钟', N'15分钟', 12.50,
            N'李娜', N'张伟', @u, @t, 'N');
END

/* ═══ 5. 无黑处理登记 WB-2026-10-0001(头 + 明细:尺寸/重量在 wh_record_detail) ═══ */
IF NOT EXISTS (SELECT 1 FROM wh_record WHERE 单据编号 = N'WB-2026-10-0001')
BEGIN
    INSERT INTO wh_record (单据编号, 单据日期, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'WB-2026-10-0001', N'2026-10-18', N'加湿防黑处理', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM wh_record_detail WHERE 单据编号 = N'WB-2026-10-0001')
BEGIN
    INSERT INTO wh_record_detail (单据编号, 成型日期, 产品编号, 尺寸, 加湿前重量, 加湿后重量,
                                  无黑时间, 取样时间, asp_user1, asp_time1, asp_cancel)
    VALUES (N'WB-2026-10-0001', N'2026-10-17', N'A-32-01', N'φ32×120', 125.5000, 131.2000,
            N'2026-10-18 09:30', N'2026-10-18 09:45', @u, @t, 'N');
END

/* ═══ 6. 封箱确认 FX-2026-10-0001(头 + 明细:装箱信息在 pack_confirm_detail) ═══ */
IF NOT EXISTS (SELECT 1 FROM pack_confirm WHERE 单据编号 = N'FX-2026-10-0001')
BEGIN
    INSERT INTO pack_confirm (单据编号, 装箱日期, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'FX-2026-10-0001', N'2026-10-18', N'装箱 10 箱×12 支', N'草稿', @u, @t, 'N');
    SET @made = @made + 1;
END
IF NOT EXISTS (SELECT 1 FROM pack_confirm_detail WHERE 单据编号 = N'FX-2026-10-0001')
BEGIN
    INSERT INTO pack_confirm_detail (单据编号, 产品编号, 装箱数量, 装箱人, 确认人, 主管签名,
                                     asp_user1, asp_time1, asp_cancel)
    VALUES (N'FX-2026-10-0001', N'A-32-01', N'120', N'王芳', N'李娜', N'张伟', @u, @t, 'N');
END

/* ═══ 7. 生产异常处理单 YC-2026-10-0001(参照真实工单 GD2608260013) ═══ */
IF NOT EXISTS (SELECT 1 FROM bd_prod_abn WHERE 单据编号 = N'YC-2026-10-0001')
BEGIN
    INSERT INTO bd_prod_abn (单据编号, 单据日期, 工单号, 产品编码, 品名, 批次号, 混料批次号, 工序,
                             发生时间, 提出人, 异常类型, 异常描述, 影响数量, 原因分析, 责任分类, 处理措施,
                             处理人, 处理日期, 结案, 备注, asp_user1, asp_time1, asp_cancel)
    VALUES (N'YC-2026-10-0001', '2026-10-18', N'GD2608260013', N'C5191H-0D20X15D8-AE', N'C5191H-0D20X15D8-AE',
            N'20260826', N'20261018', N'OP-CX', '2026-10-18', N'王芳', N'质量',
            N'成型段毛边超标,连续 20 支需返修', 20.0000, N'模具磨损导致飞边', N'生产',
            N'更换模具并全数复检,20 支返修后合格', N'张伟', '2026-10-18', N'否', N'待结案', @u, @t, 'N');
    SET @made = @made + 1;
END

/* ═══ 8. 修孤儿:TR-2026-09-0001 / HH-2026-09-0001 补单据头 + 补空明细 ═══ */
IF NOT EXISTS (SELECT 1 FROM feed_confirm WHERE 单据编号 = N'TR-2026-09-0001')
   AND EXISTS (SELECT 1 FROM feed_confirm_detail WHERE 单据编号 = N'TR-2026-09-0001')
BEGIN
    INSERT INTO feed_confirm (单据编号, 单据日期, 物料名称, 批号, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'TR-2026-09-0001', N'2026-09-30', N'S阻垢炭棒/滤芯', N'20260930', N'补登历史单据头(原为孤儿明细)', N'草稿', @u, @t, 'N');
    UPDATE feed_confirm_detail
       SET 投料成分 = ISNULL(投料成分, N'活性炭粉'), 阶段 = ISNULL(阶段, N'溶解'),
           理论数量 = ISNULL(理论数量, 500.0000), 实际重量 = ISNULL(实际重量, 499.0000),
           投料人 = ISNULL(投料人, N'张伟'), 是否确认 = ISNULL(是否确认, N'是'), 确认人 = ISNULL(确认人, N'李娜')
     WHERE 单据编号 = N'TR-2026-09-0001' AND (投料成分 IS NULL OR 阶段 IS NULL OR 理论数量 IS NULL);
    SET @made = @made + 1;
END

IF NOT EXISTS (SELECT 1 FROM mix_record WHERE 单据编号 = N'HH-2026-09-0001')
   AND EXISTS (SELECT 1 FROM mix_record_detail WHERE 单据编号 = N'HH-2026-09-0001')
BEGIN
    INSERT INTO mix_record (单据编号, 单据日期, 物料编码, 物料名称, 生产批次, 操作人, 核对人, 备注, 单据状态, asp_user1, asp_time1, asp_cancel)
    VALUES (N'HH-2026-09-0001', N'2026-09-30', N'A-32-01', N'S阻垢炭棒/滤芯', N'20260930', N'张伟', N'李娜', N'补登历史单据头(原为孤儿明细)', N'草稿', @u, @t, 'N');
    UPDATE mix_record_detail
       SET 混合次序 = ISNULL(混合次序, N'第一次'), 投料时间 = ISNULL(投料时间, N'2026-09-30 08:30'),
           物料单批次 = ISNULL(物料单批次, N'20260930'), 重量 = ISNULL(重量, 250.0000), 混合时间 = ISNULL(混合时间, 15.00)
     WHERE 单据编号 = N'HH-2026-09-0001' AND (混合次序 IS NULL OR 重量 IS NULL);
    SET @made = @made + 1;
END

/* ═══ 9. 自检:7 张主样例单据必须都在,且明细行齐全 ═══ */
DECLARE @miss int = 0;
IF NOT EXISTS (SELECT 1 FROM day_report    WHERE 单据编号 = N'RB-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM feed_confirm  WHERE 单据编号 = N'TR-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM mix_record    WHERE 单据编号 = N'HH-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM gran_record   WHERE 单据编号 = N'LZ-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM wh_record     WHERE 单据编号 = N'WB-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM pack_confirm  WHERE 单据编号 = N'FX-2026-10-0001') SET @miss = @miss + 1;
IF NOT EXISTS (SELECT 1 FROM bd_prod_abn   WHERE 单据编号 = N'YC-2026-10-0001') SET @miss = @miss + 1;
IF @miss > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 张样例单据没有落库', 16, 1, @miss);
    RETURN;
END

/* 明细行数不得为 0(头有行、明细空 = 仍然是一张空单据) */
DECLARE @emptyDetail nvarchar(200) = N'';
IF NOT EXISTS (SELECT 1 FROM day_report_detail   WHERE 单据编号 = N'RB-2026-10-0001') SET @emptyDetail += N' day_report_detail';
IF NOT EXISTS (SELECT 1 FROM feed_confirm_detail WHERE 单据编号 = N'TR-2026-10-0001') SET @emptyDetail += N' feed_confirm_detail';
IF NOT EXISTS (SELECT 1 FROM mix_record_detail   WHERE 单据编号 = N'HH-2026-10-0001') SET @emptyDetail += N' mix_record_detail';
IF NOT EXISTS (SELECT 1 FROM gran_record_detail  WHERE 单据编号 = N'LZ-2026-10-0001') SET @emptyDetail += N' gran_record_detail';
IF NOT EXISTS (SELECT 1 FROM wh_record_detail    WHERE 单据编号 = N'WB-2026-10-0001') SET @emptyDetail += N' wh_record_detail';
IF NOT EXISTS (SELECT 1 FROM pack_confirm_detail WHERE 单据编号 = N'FX-2026-10-0001') SET @emptyDetail += N' pack_confirm_detail';
IF LEN(@emptyDetail) > 0
BEGIN
    RAISERROR(N'[FAIL] 这些明细表没有数据:%s', 16, 1, @emptyDetail);
    RETURN;
END

/* 孤儿明细必须归零 */
DECLARE @orphan int =
    (SELECT COUNT(1) FROM feed_confirm_detail d WHERE NOT EXISTS (SELECT 1 FROM feed_confirm h WHERE h.单据编号 = d.单据编号))
  + (SELECT COUNT(1) FROM mix_record_detail   d WHERE NOT EXISTS (SELECT 1 FROM mix_record   h WHERE h.单据编号 = d.单据编号));
IF @orphan > 0
BEGIN
    RAISERROR(N'[FAIL] 仍有 %d 行明细找不到单据头', 16, 1, @orphan);
    RETURN;
END

PRINT N'[OK] 本次新增 ' + CAST(@made AS nvarchar(10)) + N' 张样例单据;7 张主样例齐全、明细非空、孤儿明细 0'
PRINT N'     清理(部署前必做):DELETE FROM day_report WHERE 单据编号 IN (...RB/TR/HH/LZ/WB/FX/YC-2026-10-0001)'
