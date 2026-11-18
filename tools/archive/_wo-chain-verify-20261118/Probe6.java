import java.sql.*;

/** 2026-11-18 第二轮验证前取证:测试库里「有台账、上游已报工、且下游还没开工」的工单行。 */
public class Probe6 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES_TEST";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            String sql = """
                SELECT TOP 15 p.id AS 行id, p.pl_no, ISNULL(p.pl_xc,0) AS 行号, ISNULL(p.scx,N'') AS 线,
                       ISNULL(p.[工艺路线],N'') AS 路线,
                       w.工序, ISNULL(w.工序序,0) AS 序, ISNULL(w.状态,N'') AS 状态,
                       CONVERT(varchar(10), w.计划开工日期,120) AS st, CONVERT(varchar(10), w.计划完工日期,120) AS cp,
                       (SELECT COUNT(*) FROM dbo.scjl s
                          WHERE s.gldh=p.pl_no AND ISNULL(s.gxdm,N'')=ISNULL(w.工序,N'')
                            AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y') AS 报工笔,
                       (SELECT CONVERT(varchar(16), MIN(COALESCE(s.kssj,s.wgsj,s.sc_date)),120) FROM dbo.scjl s
                          WHERE s.gldh=p.pl_no AND ISNULL(s.gxdm,N'')=ISNULL(w.工序,N'')
                            AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y') AS 首次报工
                  FROM dbo.wo_process_line w
                  JOIN dbo.plang p ON p.id = w.工单行id AND ISNULL(p.asp_cancel,'N')<>'Y'
                 WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''
                   AND ISNULL(w.状态,N'') <> N'已完工'
                   AND EXISTS (SELECT 1 FROM dbo.wo_process_line w2
                                WHERE ISNULL(w2.asp_cancel,'N')<>'Y' AND w2.工单行id=w.工单行id)
                 ORDER BY p.id DESC, ISNULL(w.工序序,999)
                """;
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
                while (r.next()) {
                    System.out.printf("行id=%s %s 行%s 线=%s 路线=%s | %s 序%s 状态=%s %s~%s 报工=%s 首次=%s%n",
                            r.getString("行id"), r.getString("pl_no"), r.getString("行号"), r.getString("线"),
                            r.getString("路线"), r.getString("工序"), r.getString("序"), r.getString("状态"),
                            r.getString("st"), r.getString("cp"), r.getString("报工笔"), r.getString("首次报工"));
                }
            }
        }
    }
}
