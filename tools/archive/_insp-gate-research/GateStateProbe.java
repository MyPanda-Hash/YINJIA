import com.yinjia.mes.service.WoInspGate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GateStateProbe.java — 检验单生成门禁(成型完成)「当前数据面」实测(只读,2026-10-16 重建库之后)。
 *
 * 为什么重测:方案初稿里的数字(正式库 424 行工单 / 1 行有成型报工)是本地库被「清库 + CSV 重导」
 * 重建**之前**量的。重建后 plang 变成 CSV 导入的 429 行、scjl 近乎清空 ⇒ 门禁的落地风险变了,
 * 方案必须按**现役数据**重写。本探针只读,不改任何数据。
 *
 * 用法(在 backend 目录下,JDK25):
 *   java -Dstdout.encoding=UTF-8 -cp "target\classes;..\tools\archive\_insp-gate-research;$(cat target\cp.txt)" GateStateProbe HSDZ_MES
 */
public class GateStateProbe {

    public static void main(String[] args) {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                        + ";encrypt=false;trustServerCertificate=true;loginTimeout=10",
                "yinjia", "Yinjia@2026");
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        System.out.println("========================= " + db + " (口径 " + WoInspGate.CALIBER + ") =========================");

        one(jdbc, "plang 总行数", "SELECT COUNT(*) FROM dbo.plang");
        one(jdbc, "plang 未作废行数", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'");
        one(jdbc, "plang 未作废且未结案(ja 非 Y/T)",
                "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') NOT IN (N'Y',N'T')");
        one(jdbc, "plang 工艺路线为空", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL([工艺路线],N'')=N''");
        one(jdbc, "plang 生产线(scx)为空", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(scx,N'')=N''");
        one(jdbc, "plang 批次号为空", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL([批次号],N'')=N''");
        System.out.println("plang 工艺路线分布: " + jdbc.queryForList(
                "SELECT TOP 8 ISNULL([工艺路线],N'(空)') AS r, COUNT(*) AS n FROM dbo.plang"
                        + " GROUP BY ISNULL([工艺路线],N'(空)') ORDER BY n DESC"));

        System.out.println();
        one(jdbc, "scjl 总行数", "SELECT COUNT(*) FROM dbo.scjl");
        one(jdbc, "scjl 已审核(wgzt=Y)行数", "SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y'");
        one(jdbc, "scjl 工单行号为空的", "SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL([工单行号],0)=0");
        one(jdbc, "scjl gd_id 非 0", "SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(gd_id,0)<>0");
        one(jdbc, "scjl 批次号为空的", "SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL([批次号],N'')=N''");
        System.out.println("scjl 已审核按工序分组: " + jdbc.queryForList(
                "SELECT ISNULL(gxdm,N'(空)') AS gx, COUNT(*) AS n, ISNULL(SUM(ISNULL(sl,0)),0) AS qty FROM dbo.scjl"
                        + " WHERE ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(gxdm,N'(空)')"));
        System.out.println("scjl 全部按工序分组: " + jdbc.queryForList(
                "SELECT ISNULL(gxdm,N'(空)') AS gx, COUNT(*) AS n FROM dbo.scjl"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(gxdm,N'(空)')"));

        System.out.println();
        one(jdbc, "plang_pc 行数", "SELECT COUNT(*) FROM dbo.plang_pc");
        one(jdbc, "plang_pc.plang_id 落在 plang 里的行数",
                "SELECT COUNT(*) FROM dbo.plang_pc pc WHERE EXISTS(SELECT 1 FROM dbo.plang p WHERE p.id=pc.plang_id)");
        one(jdbc, "bs_route 带「成型」的路线数",
                "SELECT COUNT(DISTINCT 工艺路线编码) FROM dbo.bs_route WHERE 工序名称=N'成型' AND ISNULL(asp_cancel,'N')<>'Y'");
        System.out.println("bs_route 带「成型」的路线: " + jdbc.queryForList(
                "SELECT 工艺路线编码 AS r, ISNULL(换算率,1) AS rate FROM dbo.bs_route"
                        + " WHERE 工序名称=N'成型' AND ISNULL(asp_cancel,'N')<>'Y'"));

        System.out.println();
        for (String[] t : new String[][]{
                {"三张检验单存活", null}}) { /* 占位,下面单独打印 */ }
        insp(jdbc, "首件检验单 QC_FIRST_INSP", "qc_first_insp_head");
        insp(jdbc, "制程检验单 QC_PROC_INSP", "qc_proc_insp_head");
        insp(jdbc, "组装成品检验单 QC_ASM_INSP", "qc_asm_insp_head");

        System.out.println();
        System.out.println("=== 门禁判定(全部未作废未结案工单行,分批调用 WoInspGate.checkPage)===");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.pl_sl,0) AS 排产数量,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')");
        Map<String, Integer> tally = new LinkedHashMap<>();
        tally.put("可开单", 0);
        tally.put("预警放行(warn 档)", 0);
        tally.put("拦截", 0);
        tally.put("免门禁(无成型工序)", 0);
        tally.put("存量放行(无任何报工)", 0);
        tally.put("存量拦截(无任何报工)", 0);
        Map<String, String> samples = new LinkedHashMap<>();
        System.out.println("门禁强度策略 = " + WoInspGate.policy(jdbc));
        for (int i = 0; i < rows.size(); i += 200) {
            List<Map<String, Object>> page = rows.subList(i, Math.min(rows.size(), i + 200));
            Map<String, WoInspGate.Status> gate = WoInspGate.checkPage(jdbc, page);
            for (Map.Entry<String, WoInspGate.Status> e : gate.entrySet()) {
                WoInspGate.Status s = e.getValue();
                if (!s.allowed()) {
                    tally.merge(s.legacy() ? "存量拦截(无任何报工)" : "拦截", 1, Integer::sum);
                    samples.putIfAbsent(s.legacy() ? "存量拦截样例" : "拦截样例", e.getKey()
                            + " 完工量=" + s.moldDone() + " 计划量=" + s.moldPlan() + " 原因=" + s.reason());
                } else if (s.warn()) {
                    tally.merge("预警放行(warn 档)", 1, Integer::sum);
                    samples.putIfAbsent("预警放行样例", e.getKey() + " 原因=" + s.reason());
                } else if (s.exempt()) {
                    tally.merge("免门禁(无成型工序)", 1, Integer::sum);
                } else if (s.legacy()) {
                    tally.merge("存量放行(无任何报工)", 1, Integer::sum);
                    samples.putIfAbsent("存量样例", e.getKey() + " 原因=" + s.reason());
                } else {
                    tally.merge("可开单", 1, Integer::sum);
                    samples.putIfAbsent("可开单样例", e.getKey() + " 完工量=" + s.moldDone() + " 计划量=" + s.moldPlan());
                }
            }
        }
        tally.entrySet().removeIf(en -> en.getValue() == 0);
        System.out.println("工单行合计 " + rows.size() + " → " + tally);
        samples.forEach((k, v) -> System.out.println("  " + k + ": " + v));
    }

    private static void one(JdbcTemplate jdbc, String label, String sql) {
        try {
            Object v = jdbc.queryForObject(sql, Object.class);
            System.out.printf("%-32s %s%n", label, v);
        } catch (Exception e) {
            System.out.printf("%-32s [ERR] %s%n", label, e.getMessage());
        }
    }

    private static void insp(JdbcTemplate jdbc, String label, String table) {
        try {
            Object n = jdbc.queryForObject("SELECT COUNT(*) FROM dbo." + table + " WHERE ISNULL(asp_cancel,'N')<>'Y'", Object.class);
            Object withWo = jdbc.queryForObject("SELECT COUNT(*) FROM dbo." + table
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工单号],N'')<>N''", Object.class);
            System.out.printf("%-28s 存活 %-6s 其中带工单号 %s%n", label, n, withWo);
        } catch (Exception e) {
            System.out.printf("%-28s [ERR] %s%n", label, e.getMessage());
        }
    }
}
