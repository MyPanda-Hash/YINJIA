SET NOCOUNT ON;
/* 关键表:本地正式库 vs 服务器快照(.bak 还原的 SRV1015)vs 测试库副本 */
SELECT v.t AS 表名, v.中文,
       (SELECT SUM(p.rows) FROM [HSDZ_MES].sys.partitions p JOIN [HSDZ_MES].sys.objects o ON o.object_id=p.object_id
         WHERE o.name=v.t AND p.index_id IN (0,1)) AS 本地正式库,
       (SELECT SUM(p.rows) FROM [HSDZ_MES_SRV1015].sys.partitions p JOIN [HSDZ_MES_SRV1015].sys.objects o ON o.object_id=p.object_id
         WHERE o.name=v.t AND p.index_id IN (0,1)) AS 服务器快照,
       (SELECT SUM(p.rows) FROM [HSDZ_MES_TEST].sys.partitions p JOIN [HSDZ_MES_TEST].sys.objects o ON o.object_id=p.object_id
         WHERE o.name=v.t AND p.index_id IN (0,1)) AS 测试库
FROM (VALUES
        (N'scjl',        N'生产记录(报工单)'),
        (N'wo_report',   N'报工单(旧表)'),
        (N'plang',       N'工单'),
        (N'plang_pc',    N'工单排产'),
        (N'bd_so_order', N'销售订单头'),
        (N'bl_so_order', N'销售订单行'),
        (N'bd_pu_order', N'采购订单头'),
        (N'bs_emp',      N'员工档案'),
        (N'dm_kh',       N'客户档案(遗留)'),
        (N'mate',        N'物料(遗留)'),
        (N'inh',         N'入库流水'),
        (N'outh',        N'出库流水'),
        (N'order_bt',    N'客户订单(遗留)'),
        (N'kucun',       N'库存(遗留)'),
        (N'yj_field',    N'面板字段注册'),
        (N'yj_panel',    N'面板注册')
     ) AS v(t, 中文)
ORDER BY v.t;
