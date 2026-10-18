SET NOCOUNT ON;
SELECT 'bl_so_order' AS 表,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_so_order a JOIN HSDZ_MES_SRV1017.dbo.bl_so_order b ON b.id=a.id) AS 同id行,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_so_order a JOIN HSDZ_MES_SRV1017.dbo.bl_so_order b ON b.单据编号=a.单据编号 AND b.存货编码=a.存货编码 AND b.数量=a.数量) AS 业务键命中,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_so_order) AS 本地行,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.dbo.bl_so_order) AS 服务器行;
SELECT 'bl_pu_order' AS 表,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_pu_order a JOIN HSDZ_MES_SRV1017.dbo.bl_pu_order b ON b.id=a.id) AS 同id行,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_pu_order a JOIN HSDZ_MES_SRV1017.dbo.bl_pu_order b ON b.单据编号=a.单据编号 AND b.物料编码=a.物料编码 AND b.数量=a.数量) AS 业务键命中,
  (SELECT COUNT(*) FROM HSDZ_MES.dbo.bl_pu_order) AS 本地行,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.dbo.bl_pu_order) AS 服务器行;
