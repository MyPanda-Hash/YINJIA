import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;

public class RouteProbe {
    public static void main(String[] a) {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT 工艺路线编码 AS route, ISNULL(加工顺序,0) AS ord, ISNULL(工序名称,N'') AS op, ISNULL(换算率,1) AS rate"
          + " FROM dbo.bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工艺路线编码, ISNULL(加工顺序,999)"))
            System.out.println(r);
        System.out.println("--- 有成型报工的行 vs 三张单在同一工单行上的分布 ---");
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT p.pl_no, p.pl_xc, ISNULL(p.pl_sl,0) AS plan_qty,"
          + " ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' AND s.gxdm=N'成型'),0) AS mold,"
          + " ISNULL((SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y'),0) AS first_n,"
          + " ISNULL((SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y'),0) AS proc_n,"
          + " ISNULL((SELECT COUNT(*) FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y'),0) AS asm_n"
          + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')"
          + "   AND (EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y')"
          + "        OR EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')"
          + "        OR EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')"
          + "        OR EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'))"))
            System.out.println(r);
    }
}
