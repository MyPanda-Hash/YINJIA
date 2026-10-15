-- _sample-align-sandbox-1014.sql — 一次性(链外,不进清单)
-- 用途:Phase 3 端到端验证的**测试夹具** —— 把测试账套里 3 张金蝶样例单据的取值,
--   对齐到**测试沙箱**(华实创新)已有的主数据,好让真推送能跑通并落单:
--     仓库 CK04/半成品仓、商品 C-95-13、计量单位 个、职员 ZY00099、部门 100000、供应商 GYS00014
--   (交集是实测出来的:测试库 bs_wh 与沙箱 /jdy/v2/bd/store 都有 CK04 半成品仓)
-- ⚠ 只作用于 asp_user1='样例取样' 的测试账套样例行;正式库不执行本脚本。
SET NOCOUNT ON;

-- 产品入库单样例:头 部门/经手人;行 商品/单位/仓库(仓库走 bs_wh 名称解析 → CK04)
UPDATE bd_finish_in SET 部门编码 = N'100000', 经手人编码 = N'ZY00099' WHERE asp_user1 = N'样例取样';
UPDATE bl_finish_in SET 产品编码 = N'C-95-13', 产品名称 = N'006项目/功能炭棒滤芯',
       计量单位 = N'个', 仓库 = N'半成品仓'
WHERE 单据编号 IN (SELECT 单据编号 FROM bd_finish_in WHERE asp_user1 = N'样例取样');

-- 其他入库单样例:供应商 + 行 商品/单位/仓库
UPDATE bd_other_in SET 供应商编码 = N'GYS00014', 供应商 = N'KG' WHERE asp_user1 = N'样例取样';
UPDATE bl_other_in SET 存货编码 = N'C-95-13', 存货名称 = N'006项目/功能炭棒滤芯',
       计量单位 = N'个', 仓库编码 = N'CK04', 仓库 = N'半成品仓'
WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE asp_user1 = N'样例取样');

-- 其他出库单样例:部门/经手人 + 行 商品/单位/仓库
UPDATE bd_other_out SET 部门编码 = N'100000', 经手人编码 = N'ZY00099' WHERE asp_user1 = N'样例取样';
UPDATE bl_other_out SET 存货编码 = N'C-95-13', 存货名称 = N'006项目/功能炭棒滤芯',
       计量单位 = N'个', 仓库编码 = N'CK04', 仓库 = N'半成品仓'
WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_out WHERE asp_user1 = N'样例取样');

-- 复位成未转 ERP(否则被重复转入守卫挡住),并清空上次失败留下的痕迹
UPDATE bd_finish_in  SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
UPDATE bd_other_in   SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
UPDATE bd_other_out  SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE asp_user1 = N'样例取样';
PRINT N'样例已对齐沙箱主数据并复位为「未转ERP」';
