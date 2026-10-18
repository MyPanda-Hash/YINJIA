import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;

public class AnchorGapProbe {
    public static void main(String[] a) {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true", "yinjia", "Yinjia@2026"));
        for (Map<String,Object> r : jdbc.queryForList("SELECT id, plang_id FROM dbo.plang_pc"))
            System.out.println("plang_pc " + r);
        for (Map<String,Object> r : jdbc.queryForList(
            "SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') AS batch FROM dbo.plang WHERE pl_no=N'GD-2026-10-0007'"))
            System.out.println("plang " + r);

        // ① 现役 reportedQty(ProcessTaskService:998)口径:rowId = 该行 plang.id
        Long rowId = jdbc.queryForObject("SELECT id FROM dbo.plang WHERE pl_no=N'GD-2026-10-0007' AND pl_xc=1", Long.class);
        Double legacy = jdbc.queryForObject(
            "SELECT ISNULL(SUM(ISNULL(s.sl,0)),0) FROM dbo.scjl s"
          + " LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
          + " WHERE s.gldh=? AND s.gxdm=? AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
          + "   AND (pc.plang_id=? OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')="
          + "        ISNULL((SELECT TOP 1 ISNULL(p.[批次号],N'') FROM dbo.plang p WHERE p.id=?), N'')))",
            Double.class, "GD-2026-10-0007", "成型", rowId, rowId);
        System.out.println("① 现役 reportedQty(两级锚定) 成型完工量 = " + legacy + "   (rowId=" + rowId + ")");

        // ② 门禁 WoInspGate 的口径(三级锚定)
        System.out.println("② WoInspGate.check 成型完工量 = "
            + com.yinjia.mes.service.WoInspGate.check(jdbc, "GD-2026-10-0007", 1).moldDone());

        // ③ 只看行号锚定
        System.out.println("③ 仅 [工单行号]=1 锚定 = " + jdbc.queryForObject(
            "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl WHERE gldh=N'GD-2026-10-0007' AND gxdm=N'成型'"
          + " AND ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工单行号],0)=1", Double.class));

        // ④ 判据统一后:转序/工序进度走的这一份(三级锚定)必须也是 161 —— 2026-10-16 起
        //    ProcessTaskService.reportedQty 已改为调用它(唯一调用点),两处屏幕不再互相矛盾
        System.out.println("④ WoInspGate.reportedQty(现役统一口径,转序/进度在用) = "
            + com.yinjia.mes.service.WoInspGate.reportedQty(jdbc, "GD-2026-10-0007", rowId, "成型"));
        System.out.println("⑤ 同一方法对「未报工的行」应返回 0(证明不是恒返非零) = "
            + com.yinjia.mes.service.WoInspGate.reportedQty(jdbc, "GD-2026-10-0001", 1L, "成型")
            + " / 该工单行 id=" + (jdbc.queryForList(
                "SELECT TOP 1 id FROM dbo.plang WHERE pl_no=N'GD-2026-10-0001' AND pl_xc=1").isEmpty()
                ? "(不存在)" : jdbc.queryForObject(
                "SELECT TOP 1 id FROM dbo.plang WHERE pl_no=N'GD-2026-10-0001' AND pl_xc=1", Object.class)));
    }
}
