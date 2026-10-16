/* test-qc-proc-insp-sample.sql(2026-10-12):造一张制程检验单测试单据(照截图数据)。
 * 用途:验证 QC_PROC_INSP 报表版式;数据即截图里的 C-84-02 / 20261006 那行 + 功能性 4 条。
 * ⚠ 仅用于版式验证,可重复执行(先按单号删旧)。
 */
SET NOCOUNT ON;
DECLARE @no nvarchar(50) = N'ZC-2026-10-0001';

DELETE FROM qc_proc_insp_detail WHERE 单据编号 = @no;
DELETE FROM qc_proc_insp_head   WHERE 单据编号 = @no;

INSERT INTO qc_proc_insp_head
 (单据编号, 单据日期, 检验时间, 检验类别, 工单号, 报工单号, 工序, 批次号, 客户名称, 产品编码, 产品名称,
  规格型号, 生产线, 生产车间, 报工数量, 抽检总量, 检验数量, 检验员, 检验日期, 总结论, 检验方案,
  文件编码, 执行标准, 单据状态, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, '2026-10-10', N'2026.10.10', N'制程检验', N'GD-2026-10-0003', N'BG-2026-10-0043', N'成型', N'20261006',
  N'对应客户项目名称', N'C-84-02', N'S阻垢炭棒/滤芯', N'对应产品整体尺寸', N'1号线', N'成型车间',
  1000, 50, 50, N'admin', '2026-10-10', N'合格', N'炭棒制程检验方案',
  N'YJ-Q-1xx', N'GB/T 17219', N'已审核', N'admin', GETDATE(), 'N');

/* 制程检验组:外观 3 项(端盖两头/管身两侧/其余) */
INSERT INTO qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量, 实测数值, 单项判定, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, N'外观', 1, N'端盖两头',   N'外观均匀完好，无弯曲变形、无明显划痕裂纹、无油污', N'目视', 50, N'无异常', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'外观', 2, N'管身两侧',   N'外观均匀完好，无弯曲变形、无明显划痕裂纹、无油污', N'目视', 50, N'无异常', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'外观', 3, N'其他外观项', N'按外观检验项目填充', N'目视', 50, N'无异常', N'合格', N'admin', GETDATE(), 'N');

/* 尺寸组:外径/内径/长度,各 5 个抽样值(与 c-95-12 报告口径一致) */
INSERT INTO qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量, 实测数值, 单项判定, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, N'尺寸', 1, N'外径', N'外径：44.5±0.5mm', N'游标卡尺', 5, N'44.5/44.6/44.5/44.7/44.6', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'尺寸', 2, N'内径', N'内径：20.8±0.5mm', N'游标卡尺', 5, N'20.9/20.8/21.0/20.7/20.8', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'尺寸', 3, N'长度', N'长度：256.5±0.5mm', N'游标卡尺', 5, N'256.2/256.2/256.9/256.4/256.6', N'合格', N'admin', GETDATE(), 'N');

/* 重量组 */
INSERT INTO qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量, 实测数值, 单项判定, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, N'重量', 1, N'出货重量', N'＞200克', N'电子秤', 5, N'234.5/230.8/234.1/225.1/226.1', N'合格', N'admin', GETDATE(), 'N');

/* 功能性测试组:4 条(照截图原文) */
INSERT INTO qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量, 实测数值, 单项判定, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, N'功能性测试', 1, N'炭棒无断裂', N'炭棒无断裂',
  N'高度30cm，水泥地面垂直跌落3次，', 1, N'无断裂', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'功能性测试', 2, N'初始流速', N'初始流速大于11.0L/min',
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，在0.2 MPa静态压力下，', 1, N'12.3L/min', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'功能性测试', 3, N'压降', N'测试流速3.0L/min，压降≤20kpa（客户要求）',
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，滤芯前后接装压力表，压力表距离滤芯位置管长为50mm，测试流速3.0L/min，通水10min后记录压差值（滤芯前压-后压）。', 1, N'15kpa', N'合格', N'admin', GETDATE(), 'N'),
 (@no, N'功能性测试', 4, N'余氯去除率', N'≥98%',
  N'将炭棒组装好装入滤瓶（20寸滤瓶），滤瓶进出水用3分管直接连接，水流方向外进内出，测试流速7.0±0.1L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，通入加标水5min后取样测试，计算去除率。', 1, N'99.1%', N'合格', N'admin', GETDATE(), 'N');

SELECT N'已造测试单 ' + @no AS 结果,
       (SELECT COUNT(*) FROM qc_proc_insp_head   WHERE 单据编号=@no) AS 头行,
       (SELECT COUNT(*) FROM qc_proc_insp_detail WHERE 单据编号=@no) AS 明细行;
GO
