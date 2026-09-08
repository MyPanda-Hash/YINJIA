-- migrate-rebuild-inventory.sql — 存货/库存/价格本三表重建(源=物料清单 BOM)
-- 新存货集 = BOM 真实父件(有子件的=产品,类别成品) ∪ 真实子件(物料,类别取BOM物料种类),剔除 T-TEST 测试残留
-- 数量随机 10~999;仓库随机 CK01~05(启用仓);价格:采购价随机 1~100.00、零售=×1.4、最高进价=×1.6;预警数量留空走全局阈值
-- 破坏性操作:三表旧数据硬删除(已确认)
SET NOCOUNT ON;
GO
-- 1. 清空三表
DELETE FROM kucun;
DELETE FROM bs_inv_price;
DELETE FROM bs_inv;
GO
-- 2. 重建存货(枚举口径:计价方式=移动平均,属性 外购,状态 启用)
INSERT INTO bs_inv ([所属类别],[存货编码],[存货名称],[规格型号],[计价方式],[属性],[计量单位],[参考成本],[最新成本],[建档日期],[停用],[状态],[备注],[asp_user1],[asp_time1],[asp_cancel])
SELECT t.kind, t.code, t.name, NULLIF(t.spec, ''), N'移动平均', N'外购', t.unit,
       c.cost, c.cost, GETDATE(), 0, N'启用', N'BOM重建(物料清单导入)', N'migration', GETDATE(), 'N'
FROM (
    -- 产品:有真实子件的父件(如 T382)
    SELECT DISTINCT b.[父件编码] AS code, b.[父件名称] AS name, N'' AS spec, b.[计量单位] AS unit, N'成品' AS kind
    FROM bs_bom b WHERE ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.[子件编码],'') <> '' AND b.[父件编码] IS NOT NULL
    UNION ALL
    -- 物料:真实子件(剔除 T-TEST 测试残留)
    SELECT DISTINCT b.[子件编码], b.[子件名称], b.[规格型号], b.[子件计量单位], ISNULL(NULLIF(b.[物料种类],''), N'物料')
    FROM bs_bom b WHERE ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.[子件编码],'') <> '' AND b.[子件编码] <> N'T-TEST'
) t
CROSS APPLY (SELECT ROUND((ABS(CHECKSUM(NEWID())) % 10000) / 100.0 + 1, 2) AS cost) c;
GO
-- 3. 重建库存(每存货一行:随机仓库/随机数量,价格=存货参考成本)
INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, [预警数量], asp_user1, asp_time1, asp_cancel)
SELECT v.[存货编码], w.ck, N'INIT-' + v.[存货编码], GETDATE(), v.q, v.q, v.[参考成本], NULL, N'migration', GETDATE(), 'N'
FROM (SELECT [存货编码], [参考成本], ABS(CHECKSUM(NEWID())) % 990 + 10 AS q, ABS(CHECKSUM(NEWID())) AS r FROM bs_inv) v
JOIN (SELECT [仓库编码] AS ck, ROW_NUMBER() OVER (ORDER BY [id]) - 1 AS idx, COUNT(*) OVER () AS n
      FROM bs_wh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([停用],0) <> 1 AND [状态] = N'启用') w
  ON w.idx = v.r % w.n;
GO
-- 4. 重建价格本(采购价=参考成本,零售=×1.4,最高进价=×1.6,最新进价=采购价)
INSERT INTO bs_inv_price ([存货编码],[存货名称],[规格型号],[计量单位],[采购价],[零售价],[最新进价],[最高进价],[建档人],[最近修改日期],[状态],[asp_user1],[asp_time1],[asp_cancel])
SELECT [存货编码],[存货名称],[规格型号],[计量单位],[参考成本], ROUND([参考成本]*1.4, 2), [参考成本], ROUND([参考成本]*1.6, 2), N'migration', GETDATE(), N'启用', N'migration', GETDATE(), 'N'
FROM bs_inv;
GO
PRINT N'存货/库存/价格本重建完成';
GO
-- 注:随机仓库必须用逐行 CHECKSUM(NEWID()) 取模;CROSS APPLY ORDER BY NEWID() 会被优化为一次求值(全落同一仓)
GO
