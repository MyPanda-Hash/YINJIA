import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * _JarClassScan.java — 「这个 fat jar 里有没有旧代码」的取证工具(2026-10-16 工单追溯 500 事故产物)。
 *
 * <p>为什么需要:下架类迁移(删表/删面板)执行后,**正在运行的旧 jar** 里代码还在查那张表,
 * 现象是接口 500 {@code Invalid object name 'dbo.xxx'},而源码看着是好的 ⇒ 极易误判成"代码丢了"。
 * 判据只有一个:**跑着的那份 jar 里还残留哪些关键字**。
 *
 * <p>用法(JDK 11+ 单文件源码直接跑,无需编译):
 * <pre>
 *   java -Dstdout.encoding=UTF-8 tools/archive/_wo-trace-500-20261016/_JarClassScan.java ^
 *        backend/target/yinjia-mes-backend-0.1.0.jar ^
 *        qc_cut_insp_head qc_mold_insp_head qc_fin_spec_head QC_MOLD_INSP QC_CUT_INSP
 * </pre>
 * ⚠ 一定要带 {@code -Dstdout.encoding=UTF-8}(本仓 JDK 25 + Windows 控制台默认 GBK,
 * 中文输出会被管道读成乱码 —— 与 {@code tools/sync-db.bat} 同一口径)。
 * 不给关键字时用 2026-10-16 下架的三张面板与其物理表的缺省集。
 *
 * <p>输出:① fat jar 自检({@code BOOT-INF/lib} 条目数,瘦 jar 会远小于 50)
 * ② 逐 class 的命中表。<b>命中表应为空</b>;非空即该 jar 落后于源码 ⇒ 停→重打包→起
 * (顺序见同目录 README.md,别在服务在跑时打包,会留瘦 jar)。
 */
public final class _JarClassScan {

    private static final String[] DEFAULT_KEYS = {
            "qc_cut_insp_head", "qc_mold_insp_head", "qc_fin_spec_head",
            "QC_MOLD_INSP", "QC_CUT_INSP", "QC_FIN_SPEC",
    };

    public static void main(String[] args) throws IOException {
        Path jar = Path.of(args.length > 0 ? args[0] : "backend/target/yinjia-mes-backend-0.1.0.jar");
        List<String> keys = new ArrayList<>();
        for (int i = 1; i < args.length; i++) keys.add(args[i]);
        if (keys.isEmpty()) keys.addAll(List.of(DEFAULT_KEYS));

        System.out.println("jar = " + jar.toAbsolutePath());
        Map<String, List<String>> hits = new LinkedHashMap<>();
        int libEntries = 0;
        int classEntries = 0;
        try (ZipFile zip = new ZipFile(jar.toFile())) {
            Enumeration<? extends ZipEntry> it = zip.entries();
            while (it.hasMoreElements()) {
                ZipEntry e = it.nextElement();
                if (e.getName().startsWith("BOOT-INF/lib/") && !e.isDirectory()) libEntries++;
                if (!e.getName().endsWith(".class") || !e.getName().startsWith("BOOT-INF/classes/")) continue;
                classEntries++;
                String text = readLatin1(zip.getInputStream(e));
                List<String> found = new ArrayList<>();
                for (String k : keys) if (text.contains(k)) found.add(k);
                if (!found.isEmpty()) hits.put(e.getName().substring("BOOT-INF/classes/".length()), found);
            }
        }
        System.out.println("fat jar 自检:BOOT-INF/lib 条目 = " + libEntries
                + (libEntries < 50 ? "   ❌(疑似瘦 jar,不要用它启动)" : "   ✅"));
        System.out.println("扫描 class = " + classEntries + " 个;关键字 = " + String.join(", ", keys));
        System.out.println();
        if (hits.isEmpty()) {
            System.out.println("[PASS] 无命中:该 jar 的 class 已不含上述已下架对象(与源码一致)。");
            return;
        }
        System.out.println("[FAIL] 命中 " + hits.size() + " 个类 —— 该 jar 落后于源码,请停服务→重打包→重启:");
        hits.forEach((cls, ks) -> System.out.println("  " + cls + "\n      -> " + String.join(", ", ks)));
        System.exit(1);
    }

    /** class 常量池是 UTF-8,但此处只做关键字子串判定 ⇒ latin1 逐字节映射即可,不会有解码异常。 */
    private static String readLatin1(InputStream in) throws IOException {
        byte[] buf = in.readAllBytes();
        return new String(buf, StandardCharsets.ISO_8859_1);
    }
}
