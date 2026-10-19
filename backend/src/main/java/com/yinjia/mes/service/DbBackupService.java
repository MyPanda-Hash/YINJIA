package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

/**
 * 数据库数据安全 —— 主动备份 / 自动备份(用户 2026-10-19「系统管理模块加一个面板,
 * 可以设置数据库数据的主动备份和自动备份的时间」)。
 *
 * <p><b>怎么备</b>:用 {@code BACKUP DATABASE [库] TO DISK = N'路径.bak' WITH FORMAT, INIT}
 * 让**数据库引擎**做完整备份(逻辑备份/导出表不是备份:事务日志、索引、约束、视图、扩展属性
 * 都要一起保下来,恢复出来才是同一个库)。路径与时间取自 {@code yj_app_setting} 的
 * {@code db_backup.*} 四个参数(见 migrate-db-backup-20261019.sql 头注),一次备份在
 * {@code yj_backup_log} 留一行(只增不改)。
 *
 * <p><b>三条安全口径</b>:
 * <ol>
 *   <li><b>只增不改</b>:备份动作不写业务表、不删数据;清理只删「备份目录里自己生成的、
 *       超出保留份数的 .bak」,且文件名必须带本库名前缀才删(防止误删同目录的其它备份);</li>
 *   <li><b>同一时刻只跑一个</b>:{@link #RUNNING} 闸门,自动任务与人工点「立即备份」不并发,
 *       避免两个 BACKUP 抢同一个文件名;</li>
 *   <li><b>失败要留痕</b>:数据库报错(权限不足/目录不可写/磁盘满)原文写进 yj_backup_log.message,
 *       前端「备份记录」直接看到,不是只写日志文件。</li>
 * </ol>
 *
 * <p><b>目录为什么要人工确认</b>:BACKUP DATABASE 由 SQL Server 服务账号写盘,不是 Java 进程,
 * 所以目录必须是**服务账号可写**的本机路径(默认 {@code C:\SQLBackup\YINJIA-MES},
 * 与既有手工备份同盘)。服务器上按实际盘符改,改完点一次「立即备份」验证。
 */
@Service
public class DbBackupService {

    private static final Logger log = LoggerFactory.getLogger(DbBackupService.class);

    /** 备份文件名里的时间戳(到秒,同一天多次备份不覆盖) */
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final DateTimeFormatter READABLE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final String KEY_ENABLED = "db_backup.auto_enabled";
    private static final String KEY_DAY = "db_backup.auto_day";
    private static final String KEY_TIME = "db_backup.auto_time";
    private static final String KEY_KEEP = "db_backup.keep_files";
    private static final String KEY_DIR = "db_backup.dir";

    private static final int DEFAULT_DAY = 1;
    private static final String DEFAULT_TIME = "02:00";
    private static final int DEFAULT_KEEP = 14;
    private static final String DEFAULT_DIR = "C:\\SQLBackup\\YINJIA-MES";

    /** 备份互斥闸:自动/手动同一时刻只跑一个 */
    private final AtomicBoolean RUNNING = new AtomicBoolean(false);

    private final JdbcTemplate jdbc;

    public DbBackupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ───────────────────────────── 读:面板首屏 ─────────────────────────────

    /**
     * 数据安全面板首屏:{dbName, isTestLedger, setting{autoEnabled, autoTime, keepFiles, dir},
     * lastAutoBackupAt, running, logs[]}。日志取最近 20 条,横向滚动由前端负责。
     */
    public Map<String, Object> overview() {
        Map<String, Object> out = new LinkedHashMap<>();
        String db = dbName();
        out.put("dbName", db);
        out.put("isTestLedger", "HSDZ_MES_TEST".equalsIgnoreCase(db));
        out.put("setting", settings());
        out.put("running", RUNNING.get());
        out.put("lastAutoBackupAt", lastAutoAt());
        out.put("nextAutoHint", nextAutoHint());
        out.put("logs", logs(20));
        return out;
    }

    /** 当前设置(键值表里没有就用默认值,不因为缺行报错)。 */
    public Map<String, Object> settings() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("autoEnabled", "Y".equalsIgnoreCase(option(KEY_ENABLED, "N")));
        out.put("autoDay", autoDay());
        out.put("autoTime", normalizeTime(option(KEY_TIME, DEFAULT_TIME)));
        out.put("keepFiles", keepFiles());
        out.put("dir", option(KEY_DIR, DEFAULT_DIR));
        return out;
    }

    /** 自动备份时间(HH:mm → LocalTime;脏值退回 02:00) */
    public LocalTime autoTime() {
        return LocalTime.parse(normalizeTime(option(KEY_TIME, DEFAULT_TIME)));
    }

    /** 每月几号自动备份(1~28;脏值退回 1 号) */
    public int autoDay() {
        String v = option(KEY_DAY, String.valueOf(DEFAULT_DAY));
        try {
            int d = Integer.parseInt(v.trim());
            return d >= 1 && d <= 28 ? d : DEFAULT_DAY;
        } catch (NumberFormatException e) {
            return DEFAULT_DAY;
        }
    }

    public boolean autoEnabled() {
        return "Y".equalsIgnoreCase(option(KEY_ENABLED, "N"));
    }

    public int keepFiles() {
        String v = option(KEY_KEEP, String.valueOf(DEFAULT_KEEP));
        try {
            return Math.max(0, Integer.parseInt(v.trim()));
        } catch (NumberFormatException e) {
            return DEFAULT_KEEP;
        }
    }

    // ───────────────────────────── 写:保存设置 ─────────────────────────────

    /**
     * 保存自动备份设置。校验口径:
     * <ul>
     *   <li>每月几号 1~28(避开月末:29~31 号在 2 月不存在,取"当月最后一天"会把日期漂移);</li>
     *   <li>时间必须是 HH:mm(允许 H:mm,统一存成 HH:mm);</li>
     *   <li>保留份数 0~365(0 = 不自动清理);</li>
     *   <li>目录必填、必须是本机绝对路径(带盘符或 UNC),且能建出来 —— 建不出来直接报错,
     *       不把"备份到不存在的目录"这种隐患留到真出事那天;</li>
     *   <li>开关只认 Y/N。</li>
     * </ul>
     */
    public Map<String, Object> save(Map<String, Object> body, String user) {
        if (body == null) body = Map.of();
        String time = normalizeTime(str(body.get("autoTime")));
        if (!isTime(time)) throw new IllegalArgumentException("自动备份时间格式应为 HH:mm,例如 02:00");
        int day;
        try {
            day = Integer.parseInt(str(body.get("autoDay")).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("每月备份日期应为整数(1~28)");
        }
        if (day < 1 || day > 28) throw new IllegalArgumentException("每月备份日期应在 1~28 号之间");
        int keep;
        try {
            keep = Integer.parseInt(str(body.get("keepFiles")).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("保留份数应为整数(0~365)");
        }
        if (keep < 0 || keep > 365) throw new IllegalArgumentException("保留份数应在 0~365 之间");
        String dir = str(body.get("dir")).trim();
        if (dir.isEmpty()) throw new IllegalArgumentException("备份目录必填");
        if (!(dir.matches("^[A-Za-z]:[\\\\/].*") || dir.startsWith("\\\\")))
            throw new IllegalArgumentException("备份目录要写本机绝对路径(如 D:\\SQLBackup\\YINJIA-MES)");
        dir = dir.replace('/', '\\');
        while (dir.endsWith("\\")) dir = dir.substring(0, dir.length() - 1);
        try {
            Files.createDirectories(Path.of(dir));
        } catch (Exception e) {
            throw new IllegalArgumentException("备份目录建不出来:" + dir + "(原因:" + e.getMessage() + ")");
        }
        boolean enabled = boolOf(body.get("autoEnabled"));
        putOption(KEY_ENABLED, enabled ? "Y" : "N", user);
        putOption(KEY_DAY, String.valueOf(day), user);
        putOption(KEY_TIME, time, user);
        putOption(KEY_KEEP, String.valueOf(keep), user);
        putOption(KEY_DIR, dir, user);
        log.info("[数据库备份] 设置已保存:自动备份={} 每月 {} 日 {} 保留={} 份 目录={} 操作人={}",
                enabled ? "开" : "关", day, time, keep, dir, user);
        return settings();
    }

    // ───────────────────────────── 跑:主动备份 / 自动备份 ─────────────────────────────

    /** 「立即备份」= 主动备份(手动)。 */
    public Map<String, Object> runNow(String user) {
        return run("手动", user);
    }

    /**
     * 执行一次完整备份。返回该次留痕行(前端直接刷「备份记录」)。
     * 失败不抛异常而返回 status=失败 —— 备份失败是**业务可见结果**(要出现在记录里),
     * 让异常冒到 GlobalExceptionHandler 只会弹一个提示,记不下原因。
     */
    public Map<String, Object> run(String type, String user) {
        if (!RUNNING.compareAndSet(false, true)) {
            Map<String, Object> busy = new LinkedHashMap<>();
            busy.put("status", "跳过");
            busy.put("message", "已有备份任务在执行,本次未启动");
            return busy;
        }
        long t0 = System.currentTimeMillis();
        LocalDateTime startedAt = LocalDateTime.now();
        String db = dbName();
        String dir = option(KEY_DIR, DEFAULT_DIR);
        String stamp = STAMP.format(startedAt);
        Path file = null;
        String error = null;
        try {
            Files.createDirectories(Path.of(dir));
            file = Path.of(dir, db + "_" + ("自动".equals(type) ? "auto" : "manual") + "_" + stamp + ".bak");
            String sql = "BACKUP DATABASE [" + db + "] TO DISK = N'" + file.toString().replace("'", "''")
                    + "' WITH FORMAT, INIT, CHECKSUM, NAME = N'" + db + " " + type + "备份 " + READABLE.format(startedAt)
                    + "', STATS = 20";
            jdbc.execute(sql);
        } catch (Exception e) {
            error = rootMessage(e);
            log.error("[数据库备份] {}备份失败:{}", type, error);
        } finally {
            long elapsed = System.currentTimeMillis() - t0;
            Long sizeKb = null;
            if (file != null) {
                try {
                    if (Files.exists(file)) sizeKb = Files.size(file) / 1024;
                } catch (IOException ignored) {
                    // 文件大小读不到不影响"备份成功"的判定;SQL Server 服务账号可能只给了 SQL 读权限
                }
            }
            String status = error == null && sizeKb != null ? "成功" : (error == null ? "失败" : "失败");
            String message = error == null
                    ? (sizeKb == null ? "备份语句已执行,但备份文件不存在或不可读,请确认目录权限" : "备份文件已生成:" + file)
                    : error;
            Map<String, Object> row = insertLog(type, status, db,
                    file == null ? null : file.toString(), sizeKb, (int) Math.min(Integer.MAX_VALUE, elapsed),
                    startedAt, LocalDateTime.now(), message, user);
            if ("成功".equals(status)) {
                int removed = prune(dir, db);
                if (removed > 0) log.info("[数据库备份] 按保留份数清理旧备份 {} 个", removed);
            }
            RUNNING.set(false);
            return row;
        }
    }

    /**
     * 自动备份调度入口(**每月一次**,2026-10-19 用户口径「显示的数据库备份记录改为每个月一次」):
     * 「启用 + 本月该时刻已到 + 本月还没成功自动备过」三者同时成立才跑。
     * 由 {@link DbBackupScheduler} 每 60 秒调用一次(不自己开线程)。
     */
    public Map<String, Object> autoTick() {
        if (!autoEnabled()) return null;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime target = monthlyTarget(now.toLocalDate());
        if (now.isBefore(target)) return null;
        if (autoDoneThisMonth()) return null;
        log.info("[数据库备份] 到达本月自动备份时间(每月 {} 日 {}),开始自动备份",
                autoDay(), normalizeTime(option(KEY_TIME, DEFAULT_TIME)));
        return run("自动", "system");
    }

    /**
     * 本月应备时刻:每月 {@code autoDay} 日的 {@code autoTime}。
     * 该月没有这一天(2 月 30 日等)⇒ 取当月最后一天 —— 月份一律 1~28 之外也兜得住。
     */
    private LocalDateTime monthlyTarget(LocalDate today) {
        int day = Math.min(autoDay(), today.lengthOfMonth());
        return today.withDayOfMonth(day).atTime(autoTime());
    }

    /** 本月是否已经自动备份成功过(每月只备一次;失败的下次 tick 会重试) */
    public boolean autoDoneThisMonth() {
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(1) FROM yj_backup_log WHERE run_type = N'自动' AND status = N'成功' AND started_at >= ?",
                    Integer.class, LocalDate.now().withDayOfMonth(1).atStartOfDay());
            return n != null && n > 0;
        } catch (Exception e) {
            log.warn("[数据库备份] 查本月自动备份记录失败:{}", e.getMessage());
            return false;
        }
    }

    // ───────────────────────────── 读:备份记录 ─────────────────────────────

    public List<Map<String, Object>> logs(int limit) {
        int top = limit <= 0 ? 20 : Math.min(limit, 500);
        try {
            return jdbc.queryForList("""
                    SELECT TOP (?) id, run_type, status, db_name, file_path, file_size_kb, elapsed_ms,
                           started_at, finished_at, message, operator
                      FROM yj_backup_log
                     ORDER BY id DESC
                    """, top);
        } catch (Exception e) {
            log.warn("[数据库备份] 读备份记录失败:{}", e.getMessage());
            return new ArrayList<>();
        }
    }

    // ───────────────────────────── 内部工具 ─────────────────────────────

    private String dbName() {
        try {
            String db = jdbc.queryForObject("SELECT DB_NAME()", String.class);
            return db == null || db.isBlank() ? "HSDZ_MES" : db;
        } catch (Exception e) {
            return "HSDZ_MES";
        }
    }

    private String option(String key, String fallback) {
        try {
            List<String> vals = jdbc.queryForList(
                    "SELECT setting_value FROM yj_app_setting WHERE setting_key = ?", String.class, key);
            if (vals.isEmpty() || vals.get(0) == null || vals.get(0).isBlank()) return fallback;
            return vals.get(0).trim();
        } catch (Exception e) {
            return fallback;
        }
    }

    private void putOption(String key, String value, String user) {
        // 只碰 asp_user1 / asp_time1(以及 asp_time2):yj_app_setting 两账套结构不完全同源,
        // 测试库没有 asp_user2 列(实测 2026-10-19,写它直接 列名无效),口径与 BatchService.saveOverRatio 一致。
        int n = jdbc.update("UPDATE yj_app_setting SET setting_value = ?, asp_user1 = COALESCE(?, asp_user1),"
                + " asp_time2 = SYSDATETIME() WHERE setting_key = ?", value, user, key);
        if (n == 0) {
            jdbc.update("INSERT INTO yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1) VALUES (?,?,?,?,SYSDATETIME())",
                    key, value, "数据库备份参数(数据安全面板维护)", user);
        }
    }

    private Map<String, Object> insertLog(String type, String status, String db, String file, Long sizeKb,
                                          int elapsedMs, LocalDateTime startedAt, LocalDateTime finishedAt,
                                          String message, String user) {
        jdbc.update("""
                INSERT INTO yj_backup_log
                  (run_type, status, db_name, file_path, file_size_kb, elapsed_ms, started_at, finished_at,
                   message, operator, asp_user1, asp_time1)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,SYSDATETIME())
                """, type, status, db, file, sizeKb, elapsedMs, startedAt, finishedAt,
                message == null ? null : (message.length() > 1000 ? message.substring(0, 1000) : message), user, user);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("runType", type);
        row.put("status", status);
        row.put("dbName", db);
        row.put("filePath", file);
        row.put("fileSizeKb", sizeKb);
        row.put("elapsedMs", elapsedMs);
        row.put("startedAt", startedAt);
        row.put("finishedAt", finishedAt);
        row.put("message", message);
        row.put("operator", user);
        if ("成功".equals(status)) log.info("[数据库备份] {}备份成功:{} ({} KB, {} ms)", type, file, sizeKb, elapsedMs);
        return row;
    }

    /**
     * 按「保留份数」清理旧备份。**只删本库前缀的 .bak**({库名}_auto_/_manual_),
     * 同目录里别的库/别的软件的文件一律不碰;keepFiles=0 表示不清理。
     */
    private int prune(String dir, String db) {
        int keep = keepFiles();
        if (keep <= 0) return 0;
        int removed = 0;
        try (Stream<Path> files = Files.list(Path.of(dir))) {
            List<Path> mine = files
                    .filter(Files::isRegularFile)
                    .filter(p -> {
                        String n = p.getFileName().toString().toLowerCase();
                        return n.endsWith(".bak") && n.startsWith((db + "_").toLowerCase());
                    })
                    .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                    .toList();
            for (int i = keep; i < mine.size(); i++) {
                try {
                    Files.delete(mine.get(i));
                    removed++;
                } catch (Exception e) {
                    log.warn("[数据库备份] 删除旧备份失败 {}:{}", mine.get(i), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("[数据库备份] 清理旧备份失败:{}", e.getMessage());
        }
        return removed;
    }

    private LocalDateTime lastAutoAt() {
        try {
            return jdbc.queryForObject(
                    "SELECT MAX(started_at) FROM yj_backup_log WHERE run_type = N'自动' AND status = N'成功'",
                    LocalDateTime.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** 下一次自动备份时刻(未启用返回 null):本月该时刻未到且本月还没备过 ⇒ 本月,否则下月 */
    private String nextAutoHint() {
        if (!autoEnabled()) return null;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next = monthlyTarget(now.toLocalDate());
        if (!next.isAfter(now) || autoDoneThisMonth()) next = monthlyTarget(now.toLocalDate().plusMonths(1));
        return READABLE.format(next);
    }

    private static boolean boolOf(Object v) {
        if (v instanceof Boolean b) return b;
        String s = str(v);
        return "Y".equalsIgnoreCase(s) || "true".equalsIgnoreCase(s) || "1".equals(s) || "是".equals(s);
    }

    private static String normalizeTime(String t) {
        String s = str(t);
        if (s.isEmpty()) return DEFAULT_TIME;
        // H:mm / HH:mm / HH:mm:ss 统一成 HH:mm
        if (s.length() >= 4 && s.charAt(s.length() - 3) == ':') {
            String[] parts = s.split(":");
            if (parts.length >= 2) {
                try {
                    int h = Integer.parseInt(parts[0].trim());
                    int m = Integer.parseInt(parts[1].trim());
                    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
                        return String.format("%02d:%02d", h, m);
                } catch (NumberFormatException ignored) {
                    // 落到下面返回原值,由调用方报格式错
                }
            }
        }
        return s;
    }

    private static boolean isTime(String t) {
        return t != null && t.matches("^([01]\\d|2[0-3]):[0-5]\\d$");
    }

    /** 异常链里最内层的中文原文(SQL Server 的真实原因在 cause 里) */
    private static String rootMessage(Throwable e) {
        Throwable cur = e;
        String msg = e == null ? "" : String.valueOf(e.getMessage());
        int guard = 0;
        while (cur.getCause() != null && cur.getCause() != cur && guard++ < 8) {
            cur = cur.getCause();
            if (cur.getMessage() != null && !cur.getMessage().isBlank()) msg = cur.getMessage();
        }
        return msg == null ? "未知错误" : msg.trim();
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
