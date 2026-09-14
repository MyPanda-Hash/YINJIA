import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Deploy executor: run a UTF-8 SQL script (split by standalone GO lines) against a remote server.
 * Usage: java -cp lib/mssql-jdbc.jar _DeployExec.java <sql-file> [server] [user] [pass] [db]
 */
public class _DeployExec {
    public static void main(String[] args) throws Exception {
        Path f = Path.of(args[0]);
        String server = args.length > 1 ? args[1] : "36.140.66.163";
        String user = args.length > 2 ? args[2] : "sa";
        String pass = args.length > 3 ? args[3] : "MES0109@@mes0109%%";
        String db = args.length > 4 ? args[4] : "HSDZ_MES";
        String url = "jdbc:sqlserver://" + server + ":1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=20";

        String content = Files.readString(f, StandardCharsets.UTF_8);
        List<String> batches = splitGo(content);
        System.out.println("script=" + f.getFileName() + " batches=" + batches.size());

        try (Connection c = DriverManager.getConnection(url, user, pass); Statement s = c.createStatement()) {
            int ok = 0;
            List<String> fails = new ArrayList<>();
            for (int i = 0; i < batches.size(); i++) {
                String b = batches.get(i);
                if (b.isBlank()) continue;
                try {
                    s.execute(b);
                    ok++;
                } catch (Exception e) {
                    String msg = String.valueOf(e.getMessage());
                    fails.add("batch#" + (i + 1) + " [" + head(b, 80) + "] => " + head(msg, 300));
                }
            }
            System.out.println("executed=" + ok + " failed=" + fails.size());
            for (String fmsg : fails) System.out.println("FAIL " + fmsg);
        }
    }

    static List<String> splitGo(String content) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : content.split("\r?\n")) {
            if (line.trim().equalsIgnoreCase("GO")) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(line).append("\n");
            }
        }
        out.add(cur.toString());
        return out;
    }

    static String head(String s, int n) {
        String one = s.replace("\n", " ").replace("\r", "").trim();
        return one.length() > n ? one.substring(0, n) + "..." : one;
    }
}
