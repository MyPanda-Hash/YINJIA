SET NOCOUNT ON;
SELECT TOP 3 id, 仓库编码, 仓库, 存货编码, 存货, 现存量 FROM (
  SELECT ROW_NUMBER() OVER (ORDER BY m.仓库, m.存货编码, m.存货) AS id,
         m.仓库编码, m.仓库, m.存货编码, m.存货, SUM(m.数量*m.sign) AS 现存量
    FROM (
      SELECT m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位 AS 主计量,
             m.收入数量 - m.发出数量 AS 数量, 0 AS sign
        FROM dbo.v_stock_movement m
    ) m GROUP BY m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量
) t ORDER BY id DESC;
