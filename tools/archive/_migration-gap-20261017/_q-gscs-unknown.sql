SET NOCOUNT ON;
/* 仅取样 gscs 那 5 个语义待定的列(该表只有 1 行,取自服务器快照) */
SELECT gsgs, gszg, xpzs, msbdh, sczg, xpbt, xpsm1, xpsm2, rem AS rem_示例, tpwz
FROM [HSDZ_MES_SRV1015].dbo.gscs;
