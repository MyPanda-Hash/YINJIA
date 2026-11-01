import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

/**
 * NewOpProbe —— 2026-10-28「新工序也能选产线」取证探针。
 *
 * <p>背景与结论见同目录 README.md / docs/design/生产流程-现役实现.md §2.2。
 * <p>⚠ 只对 **测试账套 HSDZ_MES_TEST** 造数(默认行 GD2608100001),跑完执行 cleanup.sql 清理。
 *
 * <p>用法(在 tools\archive\_newop-line-pick-20261028 下):
 * <pre>java -Dstdout.encoding=UTF-8 -cp ..\..\lib\mssql-jdbc.jar NewOpProbe.java</pre>
 */
public class NewOpProbe {

    static final String BASE = "http://127.0.0.1:8090";
    static final String DB = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false";
    static final String PL_NO = "GD2608100001";
    static final String ROUTE = "GY-TEST-FX-20261028";
    static String token;

    public static void main(String[] args) throws Exception {
        prepare();
        token = login();
        System.out.println("\n===== ① routeSteps:封箱的车间写成产线档案里不存在的「装箱车间」 =====");
        System.out.println(post("/api/px/scheduleBoard/routeSteps",
                "{\"加工单号\":\"" + PL_NO + "\"}").body());
        System.out.println("\n===== ② preplan:封箱 → 切炭4(X)(跨车间;改前必报「应进的装箱车间不一致」) =====");
        System.out.println(post("/api/px/scheduleBoard/preplan",
                "{\"加工单号\":\"" + PL_NO + "\",\"排产数量\":100,\"步骤\":["
                        + "{\"工序\":\"成型\",\"生产线\":\"1号机\"},"
                        + "{\"工序\":\"封箱\",\"生产线\":\"切炭4(X)\"}]}").body());
        System.out.println("\n===== ③ 回归:成型 → 切炭4(X) 必须仍被拦 =====");
        System.out.println(post("/api/px/scheduleBoard/preplan",
                "{\"加工单号\":\"" + PL_NO + "\",\"排产数量\":100,\"步骤\":["
                        + "{\"工序\":\"成型\",\"生产线\":\"切炭4(X)\"},"
                        + "{\"工序\":\"封箱\",\"生产线\":\"切炭4(X)\"}]}").body());
        System.out.println("\n(取证完成;执行 cleanup.sql 清掉临时路线与预排台账)");
    }

    /** 造数:临时路线(成型 → 封箱,封箱车间=装箱车间,产线档案里没有)+ 工单挂上去 */
    static void prepare() throws Exception {
        try (Connection c = DriverManager.getConnection(DB, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            st.executeUpdate("DELETE FROM dbo.bs_route WHERE 工艺路线编码='" + ROUTE + "'");
            st.executeUpdate("INSERT INTO dbo.bs_route (工艺路线编码,工艺路线名称,工序编码,工序名称,生产车间,换算率,加工顺序,状态,asp_cancel)"
                    + " VALUES ('" + ROUTE + "','临时验证-新工序','OP-CX','成型',N'成型',1,1,N'已审核',N'N'),"
                    + "        ('" + ROUTE + "','临时验证-新工序','OP-FX','封箱',N'装箱车间',1,2,N'已审核',N'N')");
            st.executeUpdate("UPDATE dbo.plang SET [工艺路线]='" + ROUTE + "' WHERE pl_no='" + PL_NO + "' AND id=1");
            System.out.println("[准备] 临时路线 " + ROUTE + "(成型 → 封箱[装箱车间]) 挂到工单 " + PL_NO);
        }
    }

    static String login() throws Exception {
        HttpResponse<String> r = post("/api/auth/login",
                "{\"userName\":\"admin\",\"password\":\"123456\",\"factory\":\"YJ_TEST\"}");
        String s = r.body();
        int i = s.indexOf("\"token\":\"");
        if (i < 0) throw new IllegalStateException("登录失败:" + s);
        return s.substring(i + 9, s.indexOf('"', i + 9));
    }

    static HttpResponse<String> post(String path, String json) throws Exception {
        HttpClient hc = HttpClient.newHttpClient();
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(BASE + path))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return hc.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
