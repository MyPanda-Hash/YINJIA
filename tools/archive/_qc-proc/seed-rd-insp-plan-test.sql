/* seed-rd-insp-plan-test.sql(2026-10-13):造一张出货检验计划测试单,用于验证
 * 「制程检验单按产品编码取出货检验计划内容」。
 *
 * 背景:RD_INSP_PLAN 现只有 1 张空壳单(产品编号为空、0 明细),而产品主档 RD_PROD_INFO
 *   也为空 ⇒ 无数据可验。本脚本造一张**明确标注测试**的计划单,产品编号对齐
 *   已有测试制程检验单 ZC-2026-10-0001 的产品编码 C-84-02。
 *
 * ⚠ 测试数据,可随时删:DELETE FROM rd_insp_plan_detail WHERE 单据编号='IP-TEST-0001';
 *                            DELETE FROM rd_insp_plan_head   WHERE 单据编号='IP-TEST-0001';
 * 幂等:先按单号删旧再插;两账套均执行。
 */
SET NOCOUNT ON;
DECLARE @no nvarchar(50) = N'IP-TEST-0001';
DECLARE @prod nvarchar(50) = N'C-84-02';

DELETE FROM rd_insp_plan_detail WHERE 单据编号 = @no;
DELETE FROM rd_insp_plan_head   WHERE 单据编号 = @no;

INSERT INTO rd_insp_plan_head
 (单据编号, 单据日期, 文档编号, 标题, 版本号, 密级, 产品编号, 客户项目名称, 产品整体尺寸,
  管理人, 编写人, 使用范围, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, '2026-10-13', N'YJ-RD001', N'【测试】出货检验项目控制计划(S阻垢炭棒 C-84-02)', N'V2026-10-13',
  N'保密', @prod, N'对应客户项目名称', N'对应产品整体尺寸',
  N'冯敏', N'admin', N'全公司', N'admin', GETDATE(), 'N');

/* 明细:4 个类别各一条,覆盖 外观/重要尺寸/重量/性能 —— 对应制程检验单的分区 */
INSERT INTO rd_insp_plan_detail
 (单据编号, 序号, 控制项目, 控制标准及要求, 控制方法, 检测频率, 检测仪器, 检验内容,
  不合格应对措施, 取样方式, 检验类别, asp_user1, asp_time1, asp_cancel)
VALUES
 (@no, N'10', N'外观-端盖两头', N'外观均匀完好，无弯曲变形、无明显划痕裂纹、无油污', N'目视',
  N'1PCS/一个生产批次', N'目视', N'外观', N'挑出不良品', N'全检', N'必测项', N'admin', GETDATE(), 'N'),
 (@no, N'20', N'尺寸-外径', N'外径：44.5±0.5mm', N'游标卡尺测量',
  N'1PCS/一个生产批次', N'卡尺', N'重要尺寸', N'挑出不良品', N'5PCS', N'必测项', N'admin', GETDATE(), 'N'),
 (@no, N'30', N'出货重量', N'＞200克', N'电子秤称量',
  N'1PCS/一个生产批次', N'电子秤', N'重量', N'挑出不良品', N'5PCS', N'必测项', N'admin', GETDATE(), 'N'),
 (@no, N'40', N'余氯去除率', N'≥98%', N'余氯去除率的加标试验，通入加标水5min后取样测试，计算去除率',
  N'型式检验', N'余氯检测仪', N'性能', N'退货', N'1PCS', N'型式检验', N'admin', GETDATE(), 'N');

SELECT N'测试出货检验计划就绪' AS 结果,
       (SELECT COUNT(*) FROM rd_insp_plan_head   WHERE 单据编号=@no) AS 头行,
       (SELECT COUNT(*) FROM rd_insp_plan_detail WHERE 单据编号=@no) AS 明细行,
       (SELECT COUNT(DISTINCT 检验内容) FROM rd_insp_plan_detail WHERE 单据编号=@no) AS 类别数;
GO
