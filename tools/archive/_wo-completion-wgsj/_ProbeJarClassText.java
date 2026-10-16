import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * 现役 jar 内 class 常量池取证:确认 8090 跑的那份 jar 里,完工时刻已经是**参数化(应用本地墙钟)**写法,
 * 而不是旧的 GETDATE()(2026-10-16 完工明细/完工时间口径任务)。
 * 用法:java _ProbeJarClassText.java <jar路径>
 */
public class _ProbeJarClassText {
    public static void main(String[] a) throws Exception {
        String jar = a.length > 0 ? a[0] : "backend/target/yinjia-mes-backend-0.1.0.jar";
        int fail = 0;
        try (ZipFile zf = new ZipFile(jar)) {
            fail += check(zf, "BOOT-INF/classes/com/yinjia/mes/service/WoReportService.class",
                    "wgsj=?", "wgsj=GETDATE()");
            fail += check(zf, "BOOT-INF/classes/com/yinjia/mes/service/ProcessTaskService.class",
                    "ISNULL(完工时间, ?)", "ISNULL(完工时间, GETDATE())");
        }
        System.out.println(fail == 0 ? "[PASS] 现役 jar 内完工时刻 = 应用本地墙钟参数化写法" : "[FAIL] " + fail + " 项");
        if (fail > 0) System.exit(1);
    }

    static int check(ZipFile zf, String entry, String want, String unwanted) throws Exception {
        ZipEntry e = zf.getEntry(entry);
        if (e == null) { System.out.println("  ❌ 缺 " + entry); return 1; }
        byte[] b;
        try (var in = zf.getInputStream(e)) { b = in.readAllBytes(); }
        String s = new String(b, StandardCharsets.UTF_8);
        boolean hasWant = s.contains(want), hasOld = s.contains(unwanted);
        System.out.printf("  %s %s: 新版\"%s\"=%s / 旧版\"%s\"=%s%n",
                (hasWant && !hasOld) ? "✅" : "❌", entry.substring(entry.lastIndexOf('/') + 1),
                want, hasWant, unwanted, hasOld);
        return (hasWant && !hasOld) ? 0 : 1;
    }
}
