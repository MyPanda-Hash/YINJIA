-- migrate-customer-code-seed.sql — 客户项目代号标准库种子(rd.customer_code)
--
-- 【自动生成,请勿手改】由 tools/gen-customer-code.cjs 从设计《二三级四级项目控制表2026.xlsx》
-- sheet《产品开发样品编号》38 个样例反推,共 34 条(校验 38 行,代号一对多冲突 0)。
--
-- 口径:样品编号 = 客户项目代号 + 项目编号(确定性拼接,38/38 复现)
--       ⇒ 代号 = 样品编号去掉末尾项目编号。
-- 用法:标准库下拉 item_code=项目名称,content=代号;字段 RD_SAMPLE_NO.客户项目代号(data_type=标准库)。
--
-- 幂等去重键:lib_code + item_code(项目名称);可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT N'rd.customer_code', s.item, s.code, s.seq, 1, N'system', SYSDATETIME()
FROM (VALUES
  (N'飞利浦抽水壶芯', N'FL', 1),
  (N'A项目', N'AB', 2),
  (N'Brita项目', N'AB', 3),
  (N'安吉尔阻垢炭棒', N'AJ', 4),
  (N'碧纯（珂睿斯）除铅滤芯', N'BC', 5),
  (N'飞利浦半脱盐项目', N'FL', 6),
  (N'飞利浦RO-PFAS项目', N'FL', 7),
  (N'碧纯高品质炭棒', N'BC', 8),
  (N'安吉尔无界项目前后置炭棒方案', N'AJ', 9),
  (N'飞利浦矿化', N'FL', 10),
  (N'GE正牌冰箱滤芯', N'GE', 11),
  (N'东莞科菱除铅炭棒', N'KL', 12),
  (N'迈博瑞重力封底滤芯', N'MB', 13),
  (N'飞利浦抑菌炭棒', N'FL', 14),
  (N'飞利浦阻垢', N'FL', 15),
  (N'碧丽口感芯', N'BL', 16),
  (N'GE制冰机滤芯', N'GE', 17),
  (N'安吉尔除铅炭棒', N'AJ', 18),
  (N'安吉尔半脱盐项目', N'AJ', 19),
  (N'飞利浦U24厨下机', N'FL', 20),
  (N'IAPMO认证项目', N'RZ', 21),
  (N'GE全屋除铅炭棒项目', N'GE', 22),
  (N'力人重力水壶项目', N'LR', 23),
  (N'青岛信民炭棒认证项目', N'QD', 24),
  (N'加贝尔废水阀阻垢项目', N'JB', 25),
  (N'加贝尔口感滤芯项目', N'JB', 26),
  (N'珂睿斯水壶芯', N'KR', 27),
  (N'浙江保时康', N'BS', 28),
  (N'四季沐歌富锶滤芯', N'MG', 29),
  (N'摩纳后置弱碱炭棒', N'MN', 30),
  (N'摩纳后置富锶含锌炭棒', N'MN', 31),
  (N'深圳净啦膜业矿化滤芯', N'JL', 32),
  (N'深圳法兰尼富锶炭棒', N'FLN', 33),
  (N'世纪丰源强碱炭棒', N'FY', 34)
) AS s(item, code, seq)
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib l
                  WHERE l.lib_code = N'rd.customer_code' AND l.item_code = s.item);
GO

PRINT N'migrate-customer-code-seed.sql 完成:34 条客户项目代号';
GO
