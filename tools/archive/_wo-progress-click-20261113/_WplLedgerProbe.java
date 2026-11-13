import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 一次性探针(只读):预排台账 wo_process_line 的列/状态取值 + 取 3~5 张在产工单号,
 * 用**与 WorkOrderProgressService 新代码同一套映射规则**算出每道工序的
 * 「生产线 / 台账状态 / 已排产」,作为编译之外的数据证据。
 *
 * <p>口径(契约 §2):工单行id = 行.id 优先;台账 工单行id IS NULL(工单级)兜底;都不命中 ⇒
 * 生产线/台账状态 = ''、已排产 = false。生产线 = 实际生产线非空取它,否则计划生产线。
 *
 * <p>跑法(tools 下,必须 JDK25 才有单文件源码模式;系统默认 java 是 1.8):
 * <pre>
 *   &amp; 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe' "-Dstdout.encoding=UTF-8" `
 *       -cp lib\mssql-jdbc.jar archive\_wo-progress-click-20261113\_WplLedgerProbe.java HSDZ_MES
 * </pre>
 */
public class _WplLedgerProbe {

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String dbUrl = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(dbUrl, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             Statement st2 = c.createStatement()) {
            c.setReadOnly(true);

            System.out.println("=== [" + db + "] ① wo_process_line 列清单 ===");
            try (ResultSet rs = st.executeQuery(
                    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS"
                            + " WHERE TABLE_NAME='wo_process_line' ORDER BY ORDINAL_POSITION")) {
                StringBuilder sb = new StringBuilder();
                while (rs.next()) sb.append(rs.getString(1)).append('(').append(rs.getString(2)).append(") ");
                System.out.println("  " + sb);
            }

            System.out.println("\n=== [" + db + "] ② 状态取值分布(未作废) ===");
            try (ResultSet rs = st.executeQuery(
                    "SELECT ISNULL(状态,N'(null)') AS st, COUNT(*) AS n,"
                            + " SUM(CASE WHEN 工单行id IS NULL THEN 1 ELSE 0 END) AS 工单级"
                            + " FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                            + " GROUP BY ISNULL(状态,N'(null)') ORDER BY n DESC")) {
                while (rs.next()) {
                    System.out.println("  " + rs.getString("st") + " : " + rs.getInt("n")
                            + " 行(其中工单级 工单行id IS NULL = " + rs.getInt("工单级") + ")");
                }
            }

            System.out.println("\n=== [" + db + "] ③ 同工序多条台账(新代码取进度最靠后一条) ===");
            try (ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) AS n FROM (SELECT 工单行id, 工序 FROM dbo.wo_process_line"
                            + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序,N'')<>N''"
                            + " GROUP BY 工单行id, 工序 HAVING COUNT(*)>1) t")) {
                if (rs.next()) System.out.println("  重复 (工单行id, 工序) 组合数 = " + rs.getInt("n"));
            }

            System.out.println("\n=== [" + db + "] ④ 抽样在产工单:路线每道工序 ⇒ 生产线/台账状态/已排产 ===");
            try (ResultSet rs = st.executeQuery(
                    "SELECT TOP 5 p.pl_no FROM dbo.plang p"
                            + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.pl_no IN"
                            + "   (SELECT 工单号 FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y')"
                            + " GROUP BY p.pl_no ORDER BY MAX(p.pl_date) DESC")) {
                while (rs.next()) sample(st2, rs.getString(1));
            }

            System.out.println("\n=== [" + db + "] ⑤ 未完工工单的工序覆盖率(已排产 true/false 两侧都要有) ===");
            coverage(st, st2);
        }
    }

    /** 未完工工单(最多 200 行)逐行按路线工序统计「有台账/无台账」 */
    private static void coverage(Statement st, Statement st2) throws Exception {
        List<Object[]> rows = new ArrayList<>();
        try (ResultSet rs = st.executeQuery(
                "SELECT TOP 200 p.id AS 行id, p.pl_no AS 工单号, ISNULL(p.[工艺路线],N'') AS 路线"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(p.[完工状态],N'')<>N'完工'"
                        + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc")) {
            while (rs.next()) rows.add(new Object[]{rs.getLong("行id"), rs.getString("工单号"), rs.getString("路线")});
        }
        Set<String> nos = new LinkedHashSet<>();
        for (Object[] r : rows) nos.add((String) r[1]);
        // 一次取齐这批工单的全部台账行
        Map<Long, Map<String, String>> byRow = new LinkedHashMap<>();
        Map<String, Map<String, String>> byOrder = new LinkedHashMap<>();
        StringBuilder in = new StringBuilder();
        for (String no : nos) {
            if (in.length() > 0) in.append(',');
            in.append(q(no));
        }
        if (in.length() > 0) {
            try (ResultSet rs = st2.executeQuery(
                    "SELECT w.工单行id AS 行id, w.工单号 AS 工单号, ISNULL(w.工序,N'') AS 工序,"
                            + " ISNULL(w.计划生产线,N'') AS 计划生产线, ISNULL(w.实际生产线,N'') AS 实际生产线"
                            + " FROM dbo.wo_process_line w"
                            + " WHERE w.工单号 IN (" + in + ") AND ISNULL(w.asp_cancel,'N')<>'Y'"
                            + "   AND ISNULL(w.工序,N'')<>N'' ORDER BY ISNULL(w.工序序,999), w.id")) {
                while (rs.next()) {
                    String op = rs.getString("工序");
                    String plan = rs.getString("计划生产线");
                    String act = rs.getString("实际生产线");
                    String line = act.isEmpty() ? plan : act;
                    Object lid = rs.getObject("行id");
                    if (lid == null) {
                        byOrder.computeIfAbsent(rs.getString("工单号"), k -> new LinkedHashMap<>()).putIfAbsent(op, line);
                    } else {
                        byRow.computeIfAbsent(rs.getLong("行id"), k -> new LinkedHashMap<>()).putIfAbsent(op, line);
                    }
                }
            }
        }
        int total = 0, hit = 0, miss = 0;
        List<String> missSamples = new ArrayList<>();
        Map<String, List<String>> routeOpsCache = new LinkedHashMap<>();
        for (Object[] r : rows) {
            long rowId = (Long) r[0];
            String no = (String) r[1];
            String route = (String) r[2];
            List<String> ops = routeOpsCache.get(route);
            if (ops == null) {
                ops = routeOps(st, route);
                routeOpsCache.put(route, ops);
            }
            Map<String, String> rowLed = byRow.getOrDefault(rowId, Map.of());
            for (String op : ops) {
                total++;
                if (rowLed.containsKey(op) || byOrder.getOrDefault(no, Map.of()).containsKey(op)) hit++;
                else {
                    miss++;
                    if (missSamples.size() < 6) missSamples.add(no + " 行id=" + rowId + " 工序=" + op);
                }
            }
        }
        System.out.println("  未完工行数=" + rows.size() + " 工序步骤数=" + total
                + " 有台账(已排产=true)=" + hit + " 无台账(已排产=false)=" + miss
                + " 覆盖率=" + (total == 0 ? "-" : (Math.round(hit * 10000d / total) / 100d + "%")));
        for (String s : missSamples) System.out.println("    无台账样例:" + s);
    }

    /** 按新代码同一口径算该工单每一行的每道工序 */
    private static void sample(Statement st, String no) throws Exception {
        System.out.println("\n  ── 工单号 " + no + " ──");

        // 行级台账:工单行id → 工序 → {生产线, 台账状态}
        // 工单级台账(工单行id IS NULL):工序 → {生产线, 台账状态}
        Map<Long, Map<String, String[]>> byRow = new LinkedHashMap<>();
        Map<String, String[]> byOrder = new LinkedHashMap<>();
        try (ResultSet rs = st.executeQuery(
                "SELECT w.工单行id AS 行id, ISNULL(w.工序,N'') AS 工序,"
                        + " ISNULL(w.计划生产线,N'') AS 计划生产线, ISNULL(w.实际生产线,N'') AS 实际生产线,"
                        + " ISNULL(w.状态,N'') AS 状态"
                        + " FROM dbo.wo_process_line w"
                        + " WHERE w.工单号 = " + q(no) + " AND ISNULL(w.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(w.工序,N'')<>N''"
                        + " ORDER BY ISNULL(w.工序序,999), w.id")) {
            while (rs.next()) {
                String op = rs.getString("工序");
                String plan = rs.getString("计划生产线");
                String act = rs.getString("实际生产线");
                String state = rs.getString("状态");
                String line = act.isEmpty() ? plan : act;
                String[] one = {line, state};
                Object lid = rs.getObject("行id");
                if (lid == null) {
                    merge(byOrder, op, one, state);
                } else {
                    merge(byRow.computeIfAbsent(rs.getLong("行id"), k -> new LinkedHashMap<>()), op, one, state);
                }
            }
        }

        // 每行按工艺路线列工序(与 stepsSummary 一致:未绑路线用标准五道)
        // ⚠ 先把行取完再逐行查路线:同一 Statement 边遍历边查询会把自己的 ResultSet 顶掉。
        List<Object[]> lineRows = new ArrayList<>();
        try (ResultSet rs = st.executeQuery(
                "SELECT p.id AS 行id, p.pl_xc AS 行号, ISNULL(p.[工艺路线],N'') AS 路线,"
                        + " ISNULL(p.scx,N'') AS 行生产线"
                        + " FROM dbo.plang p WHERE p.pl_no = " + q(no) + " AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " ORDER BY p.pl_xc")) {
            while (rs.next()) {
                lineRows.add(new Object[]{rs.getLong("行id"), rs.getInt("行号"),
                        rs.getString("路线"), rs.getString("行生产线")});
            }
        }
        for (Object[] lr : lineRows) {
            long rowId = (Long) lr[0];
            String route = (String) lr[2];
            List<String> ops = routeOps(st, route);
            System.out.println("    行id=" + rowId + " 行号=" + lr[1]
                    + " 路线=" + (route.isEmpty() ? "(未绑,回退标准五道)" : route)
                    + " 行.生产线=" + lr[3]);
            Map<String, String[]> rowLed = byRow.getOrDefault(rowId, Map.of());
            for (String op : ops) {
                String[] s = rowLed.get(op);
                String from = s != null ? "行级" : "";
                if (s == null) { s = byOrder.get(op); from = s != null ? "工单级兜底" : "无台账"; }
                System.out.println("       工序=" + op
                        + " 生产线=" + (s == null ? "''" : "'" + s[0] + "'")
                        + " 台账状态=" + (s == null ? "''" : s[1])
                        + " 已排产=" + (s != null)
                        + "   ← " + from);
            }
        }
    }

    private static void merge(Map<String, String[]> target, String op, String[] one, String state) {
        String[] old = target.get(op);
        if (old == null || rank(old[1]) <= rank(state)) target.put(op, one);
    }

    /** 与 WorkOrderProgressService.ledgerRank 同口径 */
    private static int rank(String state) {
        if ("已完工".equals(state)) return 3;
        if ("已落实".equals(state)) return 2;
        if ("计划".equals(state)) return 1;
        return 0;
    }

    private static List<String> routeOps(Statement st, String route) throws Exception {
        Set<String> ops = new LinkedHashSet<>();
        if (route != null && !route.isEmpty()) {
            try (ResultSet rs = st.executeQuery(
                    "SELECT 工序名称 FROM dbo.bs_route WHERE 工艺路线编码=" + q(route)
                            + " AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                            + " ORDER BY ISNULL(加工顺序,999)")) {
                while (rs.next()) ops.add(rs.getString(1).trim());
            }
        }
        if (ops.isEmpty()) {
            for (String op : new String[]{"混料", "成型", "切炭", "组装", "装箱"}) ops.add(op);
        }
        return new ArrayList<>(ops);
    }

    private static String q(String s) {
        return "'" + s.replace("'", "''") + "'";
    }
}
