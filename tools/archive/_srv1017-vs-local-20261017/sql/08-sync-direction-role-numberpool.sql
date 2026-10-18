SET NOCOUNT ON;
PRINT '===== A) 金蝶同步字段方向抽查:1 张销售订单的同步字段本地 vs 服务器 =====';
SELECT 'LOC' AS 来源, 单据编号, 外部数据ID, 外部指纹, 修改时间, 客户id, 客户, 单据状态, 未核销金额, 附件地址 FROM HSDZ_MES.dbo.bd_so_order WHERE 单据编号='ZL-20261016-01'
UNION ALL
SELECT 'SRV', 单据编号, 外部数据ID, 外部指纹, 修改时间, 客户id, 客户, 单据状态, 未核销金额, 附件地址 FROM HSDZ_MES_SRV1017.dbo.bd_so_order WHERE 单据编号='ZL-20261016-01';

PRINT '===== B) bl_so_order 列清单 =====';
SELECT c.name AS col FROM HSDZ_MES.sys.columns c JOIN HSDZ_MES.sys.tables t ON t.object_id=c.object_id WHERE t.name='bl_so_order' ORDER BY c.column_id;

PRINT '===== C) 角色 1025 =====';
SELECT * FROM HSDZ_MES.dbo.yj_role WHERE id=1025;
PRINT '--- 各角色面板授权数:本地 vs 服务器 ---';
SELECT r.id, r.role_name,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.yj_role_panel p WHERE p.role_id=r.id) AS 本地,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.dbo.yj_role_panel p WHERE p.role_id=r.id) AS 服务器
FROM HSDZ_MES.dbo.yj_role r ORDER BY r.id;

PRINT '===== D) s_allno 号码池差异 =====';
SELECT 'SRV' AS 来源, comm, ID, dh, lb, ny FROM HSDZ_MES_SRV1017.dbo.s_allno s
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.dbo.s_allno l WHERE l.comm=s.comm AND l.ID=s.ID)
UNION ALL
SELECT 'LOC', comm, ID, dh, lb, ny FROM HSDZ_MES.dbo.s_allno l
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.s_allno s WHERE s.comm=l.comm AND s.ID=l.ID);

