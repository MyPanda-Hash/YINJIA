/* seed-qc-rod-inspect-items.sql(2026-10-12):炭棒制程检验项目样例(A/B/C/D/E 五类)。
 *
 * 目的:让「检验项目设定」有炭棒类数据可选 —— 现有 bs_qc_item 14 条全是 Y 料的
 *   (目数/性能/卫生安全),没有炭棒的外观/尺寸/重量 等。
 * 数据以「检验内容」= 类别承载(外观/尺寸/重量/功能性测试),带入检验单时写进「表区」。
 * ⚠ 示例数据,业务可在弹窗里直接改;幂等(按 项目编码 判存在)。
 */
SET NOCOUNT ON;
DECLARE @plan nvarchar(50) = N'QP-CARBON-ROD';

/* 方案:炭棒制程检验方案 */
IF NOT EXISTS (SELECT 1 FROM bs_qc_plan WHERE 方案编码 = @plan)
  INSERT INTO bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, 取样规则, 文件编码, 执行标准, 停用, 状态, asp_user1, asp_time1, asp_cancel)
  VALUES (@plan, N'炭棒制程检验方案', N'C-84-02', N'成品', N'抽检',
          N'1PCS/一个生产批次', N'YJ-Q-1xx', N'GB/T 17219', 0, N'启用', N'admin', GETDATE(), 'N');
GO

DECLARE @plan nvarchar(50) = N'QP-CARBON-ROD';
DECLARE @items TABLE (编码 nvarchar(50), 名称 nvarchar(100), 类别 nvarchar(50), 标准 nvarchar(200),
                      单位 nvarchar(20), 规则 nvarchar(20), 下限 decimal(18,4), 上限 decimal(18,4),
                      序号 int, 方法 nvarchar(300), 取样 nvarchar(100));
INSERT INTO @items VALUES
 /* A. 外观 */
 (N'ROD-APP-END',  N'外观-端盖两头', N'外观', N'外观均匀完好，无弯曲变形、无明显划痕裂纹、无油污', N'', N'等于判定', NULL, NULL, 10, N'目视', N'全检'),
 (N'ROD-APP-BODY', N'外观-管身两侧', N'外观', N'外观均匀完好，无弯曲变形、无明显划痕裂纹、无油污', N'', N'等于判定', NULL, NULL, 20, N'目视', N'全检'),
 /* B. 尺寸(5 个测量值) */
 (N'ROD-DIM-OD',   N'尺寸-外径',     N'尺寸', N'外径：44.5±0.5mm',  N'mm', N'区间判定', 44,  45,  30, N'游标卡尺测量', N'5PCS'),
 (N'ROD-DIM-ID',   N'尺寸-内径',     N'尺寸', N'内径：20.8±0.5mm',  N'mm', N'区间判定', 20.3, 21.3, 40, N'游标卡尺测量', N'5PCS'),
 (N'ROD-DIM-L',    N'尺寸-长度',     N'尺寸', N'长度：256.5±0.5mm', N'mm', N'区间判定', 256, 257, 50, N'游标卡尺测量', N'5PCS'),
 /* C. 重量 */
 (N'ROD-WT',       N'出货重量',      N'重量', N'＞200克',           N'g',  N'下限判定', 200, NULL, 60, N'电子秤称量', N'5PCS'),
 /* D. 功能性测试 */
 (N'ROD-FN-DROP',  N'炭棒无断裂',    N'功能性测试', N'炭棒无断裂', N'', N'等于判定', NULL, NULL, 70, N'高度30cm，水泥地面垂直跌落3次，', N'1PCS'),
 (N'ROD-FN-FLOW',  N'初始流速',      N'功能性测试', N'初始流速大于11.0L/min', N'L/min', N'下限判定', 11, NULL, 80,
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，在0.2 MPa静态压力下，', N'1PCS'),
 (N'ROD-FN-DP',    N'压降',          N'功能性测试', N'测试流速3.0L/min，压降≤20kpa（客户要求）', N'kpa', N'上限判定', NULL, 20, 90,
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，滤芯前后接装压力表，压力表距离滤芯位置管长为50mm，测试流速3.0L/min，通水10min后记录压差值（滤芯前压-后压）。', N'1PCS'),
 (N'ROD-FN-CL',    N'余氯去除率',    N'功能性测试', N'≥98%', N'%', N'下限判定', 98, NULL, 100,
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，测试流速7.0±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，通入加标水5min后取样测试，计算去除率。', N'1PCS');

DECLARE @c nvarchar(50), @n nvarchar(100), @cat nvarchar(50), @std nvarchar(200), @u nvarchar(20),
        @r nvarchar(20), @lo decimal(18,4), @hi decimal(18,4), @seq int, @m nvarchar(300), @s nvarchar(100);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT 编码,名称,类别,标准,单位,规则,下限,上限,序号,方法,取样 FROM @items;
OPEN cur FETCH NEXT FROM cur INTO @c,@n,@cat,@std,@u,@r,@lo,@hi,@seq,@m,@s;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bs_qc_item WHERE 项目编码 = @c)
    INSERT INTO bs_qc_item (项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则,
                            标准下限, 标准上限, 停用, 方案编码, 序号, 取样要求, 检验方法, asp_user1, asp_time1, asp_cancel)
    VALUES (@c, @n, @cat, @std, N'定量', @u, @r, @lo, @hi, 0, @plan, @seq, @s, @m, N'admin', GETDATE(), 'N');
  FETCH NEXT FROM cur INTO @c,@n,@cat,@std,@u,@r,@lo,@hi,@seq,@m,@s;
END
CLOSE cur DEALLOCATE cur;

SELECT N'炭棒检验项目样例已就绪' AS 结果,
       (SELECT COUNT(*) FROM bs_qc_item WHERE 方案编码 = @plan) AS 项目数,
       (SELECT COUNT(DISTINCT 检验内容) FROM bs_qc_item WHERE 方案编码 = @plan) AS 类别数;
GO
