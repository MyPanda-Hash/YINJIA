package com.yinjia.mes.service;

import com.aliyun.alimt20181012.Client;
import com.aliyun.alimt20181012.models.TranslateGeneralRequest;
import com.aliyun.alimt20181012.models.TranslateGeneralResponse;
import com.aliyun.teaopenapi.models.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 通用翻译服务(CONTEXT.md「翻译表」决策):
 * - 译名存 yj_translation(scope, ref_key=中文原文, locale),任意语言=加行不加列;
 * - 查询带 30s 内存缓存;
 * - miss 时调阿里云通用翻译(与 OCR 同厂同凭证)兜底,结果写回翻译表成为缓存(source='mt');
 * - 业务事实数据不经此服务(ADR-0001),仅覆盖字段标签/面板名/前端 UI 词条。
 */
@Service
public class TranslationService {

    private static final long TTL_MS = 30_000L;
    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);

    private final JdbcTemplate jdbc;
    private final String accessKeyId;
    private final String accessKeySecret;
    private final String endpoint;

    /** 缓存:locale → scope → (中文原文 → 译名)。 */
    private volatile Map<String, Map<String, Map<String, String>>> cache = Map.of();
    /** 各语言缓存加载时间(per-locale;invalidate 时删除对应键,避免他语 reload 掩护本语过期数据)。 */
    private final Map<String, Long> loadedAtByLocale = new ConcurrentHashMap<>();
    private volatile Client mtClient;
    /** 机翻并行执行器(10 并发:阿里云通用翻译 QPS 余量内,170 词条秒级完成)。 */
    private final ExecutorService mtPool = Executors.newFixedThreadPool(10, r -> {
        Thread t = new Thread(r, "mt-translate");
        t.setDaemon(true);
        return t;
    });

    public TranslationService(JdbcTemplate jdbc,
                              @Value("${yinjia.ocr.access-key-id:}") String accessKeyId,
                              @Value("${yinjia.ocr.access-key-secret:}") String accessKeySecret,
                              @Value("${yinjia.ocr.endpoint:}") String endpoint) {
        this.jdbc = jdbc;
        this.accessKeyId = accessKeyId;
        this.accessKeySecret = accessKeySecret;
        this.endpoint = endpoint;
        log.info("translation-service: AK {} (endpoint={})",
                accessKeyId == null || accessKeyId.isBlank() ? "NOT configured" : "configured", endpoint);
    }

    /** 加载某语言全部译名(scope→(中文原文→译名)),带 TTL 缓存。 */
    public Map<String, Map<String, String>> byLocale(String locale) {
        String key = keyOf(locale);
        Map<String, Map<String, Map<String, String>>> snapshot = cache;
        Long ts = loadedAtByLocale.get(key);
        if (!snapshot.containsKey(key) || ts == null || System.currentTimeMillis() - ts > TTL_MS) {
            reload(key);
            snapshot = cache;
        }
        Map<String, Map<String, String>> result = snapshot.get(key);
        return result != null ? result : Map.of();
    }

    /** 单 scope 查询(常用于面板配置生成)。 */
    public Map<String, String> scope(String locale, String scope) {
        return byLocale(locale).getOrDefault(scope, Map.of());
    }

    private synchronized void reload(String key) {
        Map<String, Map<String, Map<String, String>>> next = new HashMap<>(cache);
        Map<String, Map<String, String>> loaded = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList("SELECT scope, ref_key, text FROM yj_translation WHERE locale = ?", key)) {
            String scope = String.valueOf(row.get("scope"));
            String refKey = String.valueOf(row.get("ref_key"));
            Object text = row.get("text");
            if (text != null) loaded.computeIfAbsent(scope, k -> new HashMap<>()).put(refKey, String.valueOf(text));
        }
        next.put(key, loaded);
        this.cache = next;
        this.loadedAtByLocale.put(key, System.currentTimeMillis());
    }

    /**
     * 翻译一批中文原文到目标语言:翻译表命中直接返回;miss 的调阿里云机翻并写回缓存表。
     * 返回 (中文原文 → 译名) 映射;机翻失败或未配置凭证时 miss 项返回空串(前端回退原文)。
     */
    public Map<String, String> translate(String locale, List<String> sources) {
        String key = keyOf(locale);
        Map<String, String> out = new LinkedHashMap<>();
        if (sources == null || sources.isEmpty() || "zh".equals(key) || "zh-CN".equalsIgnoreCase(key)) return out;
        Map<String, String> fieldDict = scope(key, "field");
        Map<String, String> uiDict = scope(key, "ui");
        Map<String, String> pending = new LinkedHashMap<>();
        for (String src : sources) {
            if (src == null || src.isBlank()) continue;
            String hit = uiDict.get(src);
            if (hit == null) hit = fieldDict.get(src);
            if (hit != null) out.put(src, hit);
            else pending.put(src, src);
        }
        if (!pending.isEmpty()) {
            // 并行机翻(10 并发),全部完成后统一落库,避免长词条串行阻塞切换体验
            List<CompletableFuture<Void>> jobs = new ArrayList<>();
            for (String src : pending.keySet()) {
                jobs.add(CompletableFuture.runAsync(() -> {
                    String translated = machineTranslate(src, key);
                    if (translated != null && !translated.isBlank()) {
                        synchronized (out) { out.put(src, translated); }
                        upsert(key, "ui", src, translated);
                    }
                }, mtPool));
            }
            try {
                CompletableFuture.allOf(jobs.toArray(new CompletableFuture[0])).join();
            } catch (Exception ignored) {
                // 个别失败不影响整体
            }
            invalidate(key);
        }
        return out;
    }

    private void invalidate(String locale) {
        Map<String, Map<String, Map<String, String>>> next = new HashMap<>(cache);
        next.remove(locale);
        this.cache = next;
        this.loadedAtByLocale.remove(locale);
    }

    private void upsert(String locale, String scope, String refKey, String text) {
        try {
            // 派生表中的参数必须显式 CAST 为 nvarchar,否则驱动按 varchar 发送,
            // 非拉丁文字(泰文/俄文等)会被替换成问号。
            jdbc.update("MERGE yj_translation AS t USING (SELECT CAST(? AS nvarchar(20)) AS scope, "
                            + "CAST(? AS nvarchar(200)) AS ref_key, CAST(? AS nvarchar(10)) AS locale, "
                            + "CAST(? AS nvarchar(500)) AS text) AS s "
                            + "ON t.scope = s.scope AND t.ref_key = s.ref_key AND t.locale = s.locale "
                            + "WHEN MATCHED THEN UPDATE SET text = s.text, updated_at = SYSDATETIME() "
                            + "WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES (s.scope, s.ref_key, s.locale, s.text, 'mt');",
                    scope, refKey, locale, text);
        } catch (Exception ignored) {
            // 缓存写失败不影响返回
        }
    }

    /** 阿里云通用文本翻译(zh→target);未配置凭证或失败返回 null。 */
    private String machineTranslate(String text, String targetLocale) {
        if (accessKeyId == null || accessKeyId.isBlank() || accessKeySecret == null || accessKeySecret.isBlank()) {
            return null;
        }
        try {
            Client client = mtClient();
            if (client == null) return null;
            TranslateGeneralRequest req = new TranslateGeneralRequest();
            req.setScene("general");
            req.setSourceLanguage("zh");
            req.setTargetLanguage(aliLang(keyOf(targetLocale)));
            req.setSourceText(text);
            req.setFormatType("text");
            TranslateGeneralResponse resp = client.translateGeneral(req);
            if (resp.getBody() != null && resp.getBody().getData() != null) {
                return resp.getBody().getData().getTranslated();
            }
            return null;
        } catch (Exception e) {
            log.warn("translation-service: machine translate failed for [{}] -> {}: {}", text, targetLocale, String.valueOf(e.getMessage()));
            return null;
        }
    }

    private synchronized Client mtClient() throws Exception {
        if (mtClient != null) return mtClient;
        if (accessKeyId == null || accessKeyId.isBlank()) return null;
        String mtEndpoint = "mt." + regionOf(endpoint) + ".aliyuncs.com";
        Config config = new Config().setAccessKeyId(accessKeyId).setAccessKeySecret(accessKeySecret);
        config.endpoint = mtEndpoint;
        mtClient = new Client(config);
        return mtClient;
    }

    /** "ocr-api.cn-hangzhou.aliyuncs.com" → "cn-hangzhou";缺省 cn-hangzhou。 */
    private static String regionOf(String ep) {
        if (ep == null || ep.isBlank()) return "cn-hangzhou";
        String[] parts = ep.split("\\.");
        for (String p : parts) if (p.startsWith("cn-") || p.startsWith("ap-") || p.startsWith("us-") || p.startsWith("eu-")) return p;
        return "cn-hangzhou";
    }

    /** 阿里云翻译目标语码:zh-TW→zh-tw,其余原样(ISO-639-1)。 */
    private static String aliLang(String locale) {
        return "zh-TW".equalsIgnoreCase(locale) ? "zh-tw" : locale;
    }

    /** 归一化 locale:en-US→en,zh→zh(基础语言键)。 */
    public static String localeKey(java.util.Locale locale) {
        if (locale == null) return "zh";
        String lang = locale.getLanguage();
        String country = locale.getCountry();
        if ("zh".equalsIgnoreCase(lang) && ("TW".equalsIgnoreCase(country) || "HK".equalsIgnoreCase(country) || "MO".equalsIgnoreCase(country))) {
            return "zh-TW";
        }
        return lang == null || lang.isBlank() ? "zh" : lang.toLowerCase();
    }

    private static String keyOf(String locale) { return locale == null ? "zh" : locale; }
}
