-- migrate-stdlib-seed.sql — 规格书章节标准库种子(《规格书示例》提取;gen-stdlib-seed.cjs 生成)
SET NOCOUNT ON;
GO
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'应用于沐浴过滤装置，直通式无需封装端盖') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'应用于沐浴过滤装置，直通式无需封装端盖', 10, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'傲美矿化后置烧结棒') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'傲美矿化后置烧结棒', 20, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'迈博瑞重力式陶瓷炭棒复合滤芯（2只装）') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'迈博瑞重力式陶瓷炭棒复合滤芯（2只装）', 30, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'伊可普006项目冰箱炭棒') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'伊可普006项目冰箱炭棒', 40, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'伊可普抑菌炭棒') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'伊可普抑菌炭棒', 50, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'1.适用范围' AND content=N'伊可普矿化炭棒') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'1.适用范围', N'伊可普矿化炭棒', 60, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'40.5(OD)*16（ID)*27(L)') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'40.5(OD)*16（ID)*27(L)', 10, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'27.5(OD)*12（ID)*110L)') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'27.5(OD)*12（ID)*110L)', 20, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'60.5(OD)*173(L)') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'60.5(OD)*173(L)', 30, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'见下表') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'见下表', 40, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'59.5(OD)*29.5（ID)*175(L)') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'59.5(OD)*29.5（ID)*175(L)', 50, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'2.整体规格参数' AND content=N'24(OD)*10（ID)*120(L)') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'2.整体规格参数', N'24(OD)*10（ID)*120(L)', 60, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'阻垢') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'阻垢', 10, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'矿化寿命') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'矿化寿命', 20, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'重力式低流速、除余氯、浊度、大肠、铅砷、汞、铬、VOCs、氯胺、PFAS等。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'重力式低流速、除余氯、浊度、大肠、铅砷、汞、铬、VOCs、氯胺、PFAS等。', 30, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'除铅、余氯、孢囊等') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'除铅、余氯、孢囊等', 40, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'抑菌、去余氯、一级颗粒物') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'抑菌、去余氯、一级颗粒物', 50, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'3.产品主要性能' AND content=N'矿化寿命、余氯寿命.') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'3.产品主要性能', N'矿化寿命、余氯寿命.', 60, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'6.包装方式' AND content=N'按照包装规范进行包装作业；
（2）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（3）托盘外层附送货信息及产品检测报告。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'6.包装方式', N'按照包装规范进行包装作业；
（2）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（3）托盘外层附送货信息及产品检测报告。', 10, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'6.包装方式' AND content=N'（1）按照包装规范进行包装作业
（2）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'6.包装方式', N'（1）按照包装规范进行包装作业
（2）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；', 20, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'6.包装方式' AND content=N'（1）炭棒需无黑、无颗粒物处理要求；
（2）炭棒立式放置，箱内用PP材质包装袋作为内衬；整箱套袋、放刀卡
（3）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（4）托盘外层附送货信息及产品检测报告。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'6.包装方式', N'（1）炭棒需无黑、无颗粒物处理要求；
（2）炭棒立式放置，箱内用PP材质包装袋作为内衬；整箱套袋、放刀卡
（3）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（4）托盘外层附送货信息及产品检测报告。', 30, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'6.包装方式' AND content=N'炭棒有无黑要求、有颗粒物要求；
按照包装规范进行包装作业；
（3）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（4）托盘外层附送货信息及产品检测报告。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'6.包装方式', N'炭棒有无黑要求、有颗粒物要求；
按照包装规范进行包装作业；
（3）纸箱外层左上角黏贴白色标签，标签内容包括：采购单号、物料编号、生产批号、包装箱号等信息；
（4）托盘外层附送货信息及产品检测报告。', 40, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'7.运输要求' AND content=N'产品在运输中应避免冲击、挤压、雨淋、受潮及化学品腐蚀。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'7.运输要求', N'产品在运输中应避免冲击、挤压、雨淋、受潮及化学品腐蚀。', 10, N'seed');
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'8.存储环境' AND content=N'产品应贮存在通风良好、干燥的室内，不得与酸、碱及有腐蚀性的物品放置一起。') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'8.存储环境', N'产品应贮存在通风良好、干燥的室内，不得与酸、碱及有腐蚀性的物品放置一起。', 10, N'seed');
GO
PRINT N'章节标准库种子完成: ' + CAST(24 AS nvarchar(10)) + N' 条';
GO
