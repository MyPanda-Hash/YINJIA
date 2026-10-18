-- migrate-emp-import-20261019.sql — 职员档案:清理本地演示数据 + 从仓库导入真实职员(2026-10-19)
--
-- 【背景】本地 bs_emp 只剩 16 行 E001-E008 演示数据(同一批重复插了两遍),
--   真实职员 122 行已不在本地;仓库 db/emp-data-20261018/职员档案-20261018.xlsx 有 130 行
--   (122 真实 + 8 演示),由 tools/archive/_emp-export-20261018/_export-emp-xlsx.mjs 导出。
--
-- 【用户口径 2026-10-19】
--   ① 「职员的信息从GitHub上导入进来,把本地的清理一遍」
--   ② 排除演示档,只导 122 行真实职员(E001-E008 是演示残留,不重新灌回库)
--   ③ 打码的联系方式留空 —— 该仓库是**公开仓库**,源文件里手机/证件号已脱敏为
--      134****9309 / 1101**********0011,当业务值写进库只会污染联系方式:
--      证件号码 / 办公电话 / 手机 / 邮箱 / 微信 一律 NULL,等拿到真实值再由业务补录。
--
-- 幂等:① 删除只命中 E001-E008 且断言 16 行;② 插入按 员工编码 NOT EXISTS 判重。
-- 本脚本由 tools/archive/_emp-import-20261019/_gen-emp-import.py 生成,勿手改。

SET NOCOUNT ON;

/* ═══ 1. 守卫:先看现状,不满足预期就停手 ═══ */
DECLARE @total int = (SELECT COUNT(1) FROM bs_emp);
DECLARE @demo int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]');
DECLARE @imported int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'ZY%');
PRINT N'  现状: bs_emp 共 ' + CAST(@total AS nvarchar(10)) + N' 行,其中演示档 ' + CAST(@demo AS nvarchar(10)) + N' 行,ZY* ' + CAST(@imported AS nvarchar(10)) + N' 行';

/* ═══ 2. 清理本地演示数据(只删 E001-E008,不碰其它行) ═══ */
IF @imported > 0
BEGIN
    PRINT N'  [SKIP] 已存在 ZY* 导入数据,跳过清理(幂等重跑)';
END
ELSE IF @demo = 0
BEGIN
    PRINT N'  [SKIP] 没有 E001-E008 演示档可清';
END
ELSE IF @total <> @demo
BEGIN
    DECLARE @extra int = @total - @demo;
    RAISERROR(N'[FAIL] bs_emp 里除演示档外还有 %d 行,拒绝继续(避免误删真实数据)', 16, 1, @extra);
    RETURN;
END
ELSE
BEGIN
    DELETE FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]';
    DECLARE @del int = @@ROWCOUNT;
    IF @del <> 16
    BEGIN
        RAISERROR(N'[FAIL] 期望删除 16 行演示档,实际 %d 行,已回滚', 16, 1, @del);
        RETURN;
    END
    PRINT N'  已删除演示档 ' + CAST(@del AS nvarchar(10)) + N' 行';
END

/* ═══ 3. 导入 122 行真实职员(员工编码判重;联系方式留空) ═══ */
DECLARE @ins int = 0;

IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00099')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00099', N'LGH', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:33', N'N', N'2178314889490196480', N'ZY00099', N'ZY00099|LGH|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00059')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00059', N'白兴发', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:33', N'N', N'2213772777486386176', N'ZY00059', N'ZY00059|白兴发|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00111')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00111', N'白自学', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:34', N'N', N'2488035518470834176', N'ZY00111', N'ZY00111|白自学|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00036')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00036', N'曹飞平', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:34', N'N', N'2199311286494390308', N'ZY00036', N'ZY00036|曹飞平|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00106')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00106', N'曾小玲', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:34', N'N', N'2468475164099204096', N'ZY00106', N'ZY00106|曾小玲|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00027')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00027', N'柴善银', N'生产管理中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:35', N'N', N'2198912116688277504', N'ZY00027', N'ZY00027|柴善银|1|', N'男', N'BM00003', N'2159610440756352000');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00120')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00120', N'车美晶', N'品质部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:35', N'N', N'2531411625261418496', N'ZY00120', N'ZY00120|车美晶|1|', N'女', N'BM00022', N'2259481876848820224');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00094')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00094', N'陈劲洲', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:35', N'N', N'2439364346678086656', N'ZY00094', N'ZY00094|陈劲洲|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00130')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00130', N'陈柯余', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:36', N'N', N'2550214354700091392', N'ZY00130', N'ZY00130|陈柯余|1|', N'女', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00025')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00025', N'陈文智', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:36', N'N', N'2198773799657262080', N'ZY00025', N'ZY00025|陈文智|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00035')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00035', N'陈秀丽', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:36', N'N', N'2199289085925902336', N'ZY00035', N'ZY00035|陈秀丽|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00132')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00132', N'陈宗杰', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:36', N'N', N'2555375523198955520', N'ZY00132', N'ZY00132|陈宗杰|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00078')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00078', N'程鹏', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:37', N'N', N'2300134850969067520', N'ZY00078', N'ZY00078| 程鹏|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00115')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00115', N'程志', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:37', N'N', N'2513970174735019008', N'ZY00115', N'ZY00115|程志|1|', N'男', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00056')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00056', N'崔小云', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:37', N'N', N'2212377327998865408', N'ZY00056', N'ZY00056|崔小云|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00072')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00072', N'调试报工用', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:38', N'N', N'2275428878161914880', N'ZY00072', N'ZY00072|调试报工用|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00129')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00129', N'杜朝军', N'X烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:38', N'N', N'2549320562098847744', N'ZY00129', N'ZY00129|杜朝军|1|', N'男', N'BM00015', N'2210520052799727616');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00117')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00117', N'段国军', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:39', N'N', N'2524735960806225959', N'ZY00117', N'ZY00117|段国军|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00095')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00095', N'段金桔', N'组装车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:39', N'N', N'2440110599795971072', N'ZY00095', N'ZY00095|段金桔|1|', N'女', N'BM00005', N'2170469887338617856');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00061')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00061', N'冯加劲', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:39', N'N', N'2218230548000684032', N'ZY00061', N'ZY00061|冯加劲|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00026')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00026', N'冯静文', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:40', N'N', N'2198904180108807168', N'ZY00026', N'ZY00026|冯静文|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00053')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00053', N'冯敏', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:40', N'N', N'2210981295260037120', N'ZY00053', N'ZY00053|冯敏|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00047')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00047', N'高卿', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:40', N'N', N'2208859551845956608', N'ZY00047', N'ZY00047|高卿|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00021')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00021', N'高世玉', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:40', N'N', N'2190927704520412160', N'ZY00021', N'ZY00021|高世玉|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00007')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00007', N'公司客户', N'惠州市银嘉环保科技有限公司本部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:41', N'N', N'2169874723377256448', N'ZY00007', N'ZY00007|公司客户|1|', N'男', N'BM00004', N'2169874731396765696');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00079')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00079', N'郭坤卫', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:41', N'N', N'2313940893930886144', N'ZY00079', N'ZY00079|郭坤卫|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00091')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00091', N'何国', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:41', N'N', N'2398813407164770304', N'ZY00091', N'ZY00091|何国|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00074')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00074', N'和志龙', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:42', N'N', N'2282809961635472384', N'ZY00074', N'ZY00074|和志龙|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00082')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00082', N'黄利红', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:42', N'N', N'2342788748263045120', N'ZY00082', N'ZY00082|黄利红|1|', N'女', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'HQS')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'HQS', N'黄淇森', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:42', N'N', N'2157415779065253888', N'HQS', N'HQS|黄淇森|1|', N'男', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00096')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00096', N'黄晓情', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:42', N'N', N'2451609126942368768', N'ZY00096', N'ZY00096|黄晓情|1|', N'女', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00065')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00065', N'姜黎明', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:43', N'N', N'2255176421997637632', N'ZY00065', N'ZY00065|姜黎明|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00013')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00013', N'蒋小刚', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:44', N'N', N'2174838713450851328', N'ZY00013', N'ZY00013|蒋小刚|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00069')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00069', N'瞿召勇', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:44', N'N', N'2265196750786580480', N'ZY00069', N'ZY00069|瞿召勇|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00052')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00052', N'黎庆勇', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:44', N'N', N'2210974472939245568', N'ZY00052', N'ZY00052|黎庆勇|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00030')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00030', N'黎勇', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:45', N'N', N'2199227813142292480', N'ZY00030', N'ZY00030|黎勇|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00097')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00097', N'黎玉华', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:45', N'N', N'2452962238613492736', N'ZY00097', N'ZY00097|黎玉华|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00116')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00116', N'李斌', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:45', N'N', N'2517672231065111552', N'ZY00116', N'ZY00116|李斌|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00092')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00092', N'李斌', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:45', N'N', N'2409557578024505344', N'ZY00092', N'ZY00092|李斌|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00044')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00044', N'李昌胜', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:46', N'N', N'2207616038672120832', N'ZY00044', N'ZY00044|李昌胜|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00084')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00084', N'李光从', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:46', N'N', N'2350197238082321408', N'ZY00084', N'ZY00084|李光从|1|', N'男', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00086')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00086', N'李光从', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:46', N'N', N'2358874903488238592', N'ZY00086', N'ZY00086|李光从|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00128')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00128', N'李国古', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:47', N'N', N'2545869885498496000', N'ZY00128', N'ZY00128|李国古|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00125')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00125', N'李国文', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:47', N'N', N'2538655266040208384', N'ZY00125', N'ZY00125|李国文|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00110')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00110', N'李建昌', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:48', N'N', N'2488035171870327808', N'ZY00110', N'ZY00110|李建昌|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00113')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00113', N'李建昌', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:48', N'N', N'2503899661048330240', N'ZY00113', N'ZY00113|李建昌|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00034')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00034', N'李建昆', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:49', N'N', N'2199231712226035712', N'ZY00034', N'ZY00034|李建昆|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00083')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00083', N'李克强', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:49', N'N', N'2348780897244931072', N'ZY00083', N'ZY00083|李克强|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00123')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00123', N'李连平', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:49', N'N', N'2534222501068690432', N'ZY00123', N'ZY00123|李连平|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00085')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00085', N'李龙', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:50', N'N', N'2356517917157356544', N'ZY00085', N'ZY00085|李龙|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00122')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00122', N'李欧德', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:50', N'N', N'2534219546978439168', N'ZY00122', N'ZY00122|李欧德|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00032')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00032', N'李石开', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:50', N'N', N'2199228171889527808', N'ZY00032', N'ZY00032|李石开|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00114')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00114', N'李宜倬', N'研发工程部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:51', N'N', N'2509574266060559360', N'ZY00114', N'ZY00114|李宜倬|1|', N'男', N'BM00011', N'2171205397854117888');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'LZW')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'LZW', N'李梓维', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:51', N'N', N'2157416577627154432', N'LZW', N'LZW|李梓维|1|', N'男', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00037')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00037', N'练庆文', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:51', N'N', N'2201643970004552704', N'ZY00037', N'ZY00037|练庆文|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'LYZ')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'LYZ', N'练玉珍', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:52', N'N', N'2527703856180262912', N'LYZ', N'LYZ|练玉珍|1|', N'女', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00015')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00015', N'廖梅茹', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:52', N'N', N'2177674215166066688', N'ZY00015', N'ZY00015|廖梅茹|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00033')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00033', N'廖志标', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:52', N'N', N'2199228579332606976', N'ZY00033', N'ZY00033|廖志标|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00077')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00077', N'林宇', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:52', N'N', N'2289992631746420736', N'ZY00077', N'ZY00077|林宇|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00019')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00019', N'刘洪均', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:53', N'N', N'2183440861612828672', N'ZY00019', N'ZY00019|刘洪均|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00063')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00063', N'刘磊', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:53', N'N', N'2254315989774748672', N'ZY00063', N'ZY00063|刘磊|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00043')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00043', N'刘学仁', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:53', N'N', N'2207614826803422208', N'ZY00043', N'ZY00043|刘学仁|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00131')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00131', N'刘应国', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:54', N'N', N'2554621681947661312', N'ZY00131', N'ZY00131|刘应国|1|', N'男', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00101')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00101', N'龙照勇', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:54', N'N', N'2454503151647134720', N'ZY00101', N'ZY00101|龙照勇|1|', N'男', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00087')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00087', N'鲁德忠', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:54', N'N', N'2358900329568909312', N'ZY00087', N'ZY00087|鲁德忠|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00089')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00089', N'鲁德忠', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:55', N'N', N'2365399841133163520', N'ZY00089', N'ZY00089|鲁德忠|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00098')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00098', N'鲁银双', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:55', N'N', N'2452964589889982464', N'ZY00098', N'ZY00098|鲁银双|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00124')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00124', N'鲁银双', N'X烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:55', N'N', N'2534312697428826112', N'ZY00124', N'ZY00124|鲁银双|1|', N'男', N'BM00015', N'2210520052799727616');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00073')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00073', N'目勒腊', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:56', N'N', N'2275492675362803712', N'ZY00073', N'ZY00073|目勒腊|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00062')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00062', N'普新', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:56', N'N', N'2225617491294539776', N'ZY00062', N'ZY00062|普新|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00103')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00103', N'普正祥', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:56', N'N', N'2468470088781648896', N'ZY00103', N'ZY00103|普正祥|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00090')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00090', N'祁勒当', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:57', N'N', N'2395648255594693632', N'ZY00090', N'ZY00090|祁勒当|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00023')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00023', N'钱小如', N'组装车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:57', N'N', N'2195776520801241088', N'ZY00023', N'ZY00023|钱小如|1|', N'女', N'BM00005', N'2170469887338617856');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00071')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00071', N'秦家友', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:57', N'N', N'2270506640706949120', N'ZY00071', N'ZY00071|秦家友|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00081')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00081', N'秦文静', N'工程技术中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:57', N'N', N'2331886458794766336', N'ZY00081', N'ZY00081|秦文静|1|', N'女', N'BM00021', N'2258911208738444288');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00112')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00112', N'沈家仪', N'品质部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:58', N'N', N'2490778427620076544', N'ZY00112', N'ZY00112|沈家仪|1|', N'女', N'BM00022', N'2259481876848820224');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00042')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00042', N'施辉宇', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:58', N'N', N'2207613607175316480', N'ZY00042', N'ZY00042|施辉宇|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'GD')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'GD', N'孙淼淼', N'采购部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:58', N'N', N'2157416748628955136', N'GD', N'GD|孙淼淼|1|', N'女', N'BM00002', N'2158093503018659840');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00016')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00016', N'谭成', N'生产管理中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:59', N'N', N'2178313249030793216', N'ZY00016', N'ZY00016|谭成|1|', N'男', N'BM00003', N'2159610440756352000');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00067')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00067', N'涂小娟', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:59', N'N', N'2261607265289162752', N'ZY00067', N'ZY00067|涂小娟|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00109')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00109', N'万胜', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:05:59', N'N', N'2474129953264881664', N'ZY00109', N'ZY00109|万胜|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00046')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00046', N'王臣民', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:00', N'N', N'2208725625655583744', N'ZY00046', N'ZY00046|王臣民|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00088')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00088', N'王德', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:00', N'N', N'2363253548046727168', N'ZY00088', N'ZY00088|王德|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00018')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00018', N'王光珍', N'生产管理中心', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:00', N'N', N'2183434422324416512', N'ZY00018', N'ZY00018|王光珍|1|', N'女', N'BM00003', N'2159610440756352000');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00080')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00080', N'王纪东', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:01', N'N', N'2327769713288939520', N'ZY00080', N'ZY00080|王纪东|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00070')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00070', N'王佳', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:01', N'N', N'2265910397334831104', N'ZY00070', N'ZY00070|王佳|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00068')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00068', N'王磊', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:01', N'N', N'2263740566627996672', N'ZY00068', N'ZY00068|王磊|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00118')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00118', N'王玲辉', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:02', N'N', N'2526350459522787328', N'ZY00118', N'ZY00118|王玲辉|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00038')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00038', N'王万华', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:02', N'N', N'2203244138931956736', N'ZY00038', N'ZY00038|王万华|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00040')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00040', N'王永品', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:02', N'N', N'2203985400400278528', N'ZY00040', N'ZY00040|王永品|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00134')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00134', N'韦兆显', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:02', N'N', N'2566231711369228288', N'ZY00134', N'ZY00134|韦兆显|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00102')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00102', N'温珊', N'品质部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:03', N'N', N'2458342672272845824', N'ZY00102', N'ZY00102|温珊|1|', N'女', N'BM00022', N'2259481876848820224');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00127')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00127', N'向晓令', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:03', N'N', N'2543713117683056640', N'ZY00127', N'ZY00127|向晓令|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00045')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00045', N'向兴发', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:03', N'N', N'2207617036924860416', N'ZY00045', N'ZY00045|向兴发|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00093')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00093', N'项小海', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:04', N'N', N'2434388220427915264', N'ZY00093', N'ZY00093|项小海|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00104')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00104', N'项小海', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:04', N'N', N'2468473849956651008', N'ZY00104', N'ZY00104|项小海|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'XQ')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'XQ', N'谢琴', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:04', N'N', N'2157416037878976512', N'XQ', N'XQ|谢琴|1|', N'女', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00058')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00058', N'徐九花', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:05', N'N', N'2213740435879327744', N'ZY00058', N'ZY00058|徐九花|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00010')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00010', N'杨阿积', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:05', N'N', N'2170454931096476672', N'ZY00010', N'ZY00010|杨阿积|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00020')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00020', N'杨大国', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:05', N'N', N'2187681879581379584', N'ZY00020', N'ZY00020|杨大国|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00064')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00064', N'杨兰凤', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:06', N'N', N'2254495084760385536', N'ZY00064', N'ZY00064|杨兰凤|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00066')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00066', N'杨茂林', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:06', N'N', N'2259650829285966855', N'ZY00066', N'ZY00066|杨茂林|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00133')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00133', N'叶惠峰', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:06', N'N', N'2556772275437203456', N'ZY00133', N'ZY00133|叶惠峰|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00014')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00014', N'叶健乐', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:06', N'N', N'2174892110338189312', N'ZY00014', N'ZY00014|叶健乐|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00055')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00055', N'叶运婷', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:07', N'N', N'2212365663052348416', N'ZY00055', N'ZY00055|叶运婷|1|', N'女', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00022')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00022', N'余均亚', N'组装车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:07', N'N', N'2195130459019561984', N'ZY00022', N'ZY00022|余均亚|1|', N'女', N'BM00005', N'2170469887338617856');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00107')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00107', N'袁五洪', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:07', N'N', N'2472774116579631104', N'ZY00107', N'ZY00107|袁五洪|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00108')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00108', N'袁玉洪', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:08', N'N', N'2473333400040231936', N'ZY00108', N'ZY00108|袁玉洪|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00100')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00100', N'张建涛', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:08', N'N', N'2452983790172201984', N'ZY00100', N'ZY00100|张建涛|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00075')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00075', N'张瑾', N'材料研发实验室1', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:08', N'N', N'2284203014187141120', N'ZY00075', N'ZY00075|张瑾|1|', N'女', N'BM00014', N'2173486575915155456');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZL')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZL', N'张莉', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:09', N'N', N'2157416879046617088', N'ZL', N'ZL|张莉|1|', N'女', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00057')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00057', N'张胜保', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:09', N'N', N'2213288180923334656', N'ZY00057', N'ZY00057|张胜保|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00126')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00126', N'张太根', N'原料车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:09', N'N', N'2541622650246118400', N'ZY00126', N'ZY00126|张太根|1|', N'男', N'BM00007', N'2170470191157222400');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00029')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00029', N'赵建成', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:10', N'N', N'2199227609148123136', N'ZY00029', N'ZY00029|赵建成|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00076')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00076', N'郑旭帮', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:10', N'N', N'2285692532358734848', N'ZY00076', N'ZY00076|郑旭帮|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00031')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00031', N'周光扩', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:10', N'N', N'2199228003496611841', N'ZY00031', N'ZY00031|周光扩|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00049')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00049', N'周荣香', N'组装车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:11', N'N', N'2208993878466477056', N'ZY00049', N'ZY00049|周荣香|1|', N'女', N'BM00005', N'2170469887338617856');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00039')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00039', N'朱旭', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:11', N'N', N'2203253305214249984', N'ZY00039', N'ZY00039|朱旭|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00051')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00051', N'字建萍', N'组装车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:11', N'N', N'2210483951024328704', N'ZY00051', N'ZY00051|字建萍|1|', N'女', N'BM00005', N'2170469887338617856');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00105')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00105', N'字先才', NULL, 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:11', N'N', N'2468474955835233280', N'ZY00105', N'ZY00105|字先才|1|', N'男', NULL, NULL);
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZY00121')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZY00121', N'邹审华2', N'烧结车间', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:12', N'N', N'2532949844704643072', N'ZY00121', N'ZY00121|邹审华2|1|', N'男', N'BM00006', N'2170470111046105088');
    SET @ins = @ins + 1;
END
IF NOT EXISTS (SELECT 1 FROM bs_emp WHERE 员工编码 = N'ZXL')
BEGIN
    INSERT INTO bs_emp ([员工编码], [员工名称], [所属部门], [停用], [状态], [asp_user1], [asp_time1], [asp_cancel], [外部数据ID], [外部单据号], [外部指纹], [性别], [部门编码], [部门id])
    VALUES (N'ZXL', N'邹新龙', N'销售部', 0, N'启用', N'jdy-sync', N'2026-09-20 05:06:12', N'N', N'2157416379672782848', N'ZXL', N'ZXL|邹新龙|1|', N'女', N'BM00001', N'2157415425770612736');
    SET @ins = @ins + 1;
END

/* ═══ 4. 自检 ═══ */
DECLARE @zy int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'ZY%');
DECLARE @totalNow int = (SELECT COUNT(1) FROM bs_emp);
DECLARE @demoLeft int = (SELECT COUNT(1) FROM bs_emp WHERE 员工编码 LIKE N'E00[1-8]');
DECLARE @maskLeft int = (SELECT COUNT(1) FROM bs_emp WHERE ISNULL(证件号码,'') LIKE N'%*%' OR ISNULL(办公电话,'') LIKE N'%*%' OR ISNULL(手机,'') LIKE N'%*%' OR ISNULL(邮箱,'') LIKE N'%*%' OR ISNULL(微信,'') LIKE N'%*%');
PRINT N'  结果: 总行数 = ' + CAST(@totalNow AS nvarchar(10)) + N' (其中 ZY* ' + CAST(@zy AS nvarchar(10)) + N'), 演示档残留 = ' + CAST(@demoLeft AS nvarchar(10)) + N', 打码值残留 = ' + CAST(@maskLeft AS nvarchar(10)) + N', 本次插入 = ' + CAST(@ins AS nvarchar(10));
IF @totalNow <> 122
BEGIN
    RAISERROR(N'[FAIL] bs_emp 应为 122 行,实际 %d', 16, 1, @totalNow);
    RETURN;
END
IF @demoLeft > 0
BEGIN
    RAISERROR(N'[FAIL] 仍有 %d 行演示档', 16, 1, @demoLeft);
    RETURN;
END
IF @maskLeft > 0
BEGIN
    RAISERROR(N'[FAIL] 仍有 %d 行联系方式是打码值', 16, 1, @maskLeft);
    RETURN;
END
PRINT N'[OK] 职员档案导入完成:122 行真实职员,演示档 0,联系方式无打码值';
