-- q-08-inv-samples.sql — 探针:界面实测要用的商品行(确认 存货编码↔存货名称 真值)
SELECT 存货编码, 存货名称, 规格型号, 计量单位 FROM bs_inv WHERE 存货编码 IN (N'YJ-YCYX-006', N'YJ-KBL-021', N'YJ-AJ-017');
