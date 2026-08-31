package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.TranslationService;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 动态语言接口:启用语言列表(切换器数据源)+ 前端 UI 词条机翻兜底。
 * 语言扩展=往 yj_locale 插一行,无需改代码(CONTEXT.md「翻译表」决策)。
 */
@RestController
@RequestMapping("/api/locale")
public class LocaleController {

    private final JdbcTemplate jdbc;
    private final TranslationService translations;

    public LocaleController(JdbcTemplate jdbc, TranslationService translations) {
        this.jdbc = jdbc;
        this.translations = translations;
    }

    /** 启用的语言列表(切换器渲染;zh-CN 恒在首位,不依赖表)。 */
    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Object> zh = new LinkedHashMap<>();
        zh.put("locale", "zh-CN");
        zh.put("nameZh", "简体中文");
        zh.put("nameNative", "简体中文");
        out.add(zh);
        jdbc.query("SELECT locale, name_zh, name_native FROM yj_locale WHERE enabled = 1 ORDER BY sort, locale",
                rs -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("locale", rs.getString("locale"));
                    m.put("nameZh", rs.getString("name_zh"));
                    m.put("nameNative", rs.getString("name_native"));
                    out.add(m);
                });
        return ApiResult.ok(out);
    }

    /**
     * 前端 UI 词条翻译:POST {locale, keys:[中文原文...]}。
     * 翻译表(ui/field scope)命中即返;miss 调阿里云机翻并缓存回表。
     * 返回 {locale, dict:{中文:译名}}——前端 merge 进 i18n biz 命名空间。
     */
    @PostMapping("/dict")
    public ApiResult<Map<String, Object>> dict(@RequestBody Map<String, Object> body) {
        String locale = String.valueOf(body.getOrDefault("locale", "")).trim();
        @SuppressWarnings("unchecked")
        List<String> keys = body.get("keys") instanceof List<?> l
                ? l.stream().map(String::valueOf).toList() : List.of();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("locale", locale);
        if (locale.isBlank() || locale.startsWith("zh") || keys.isEmpty()) {
            out.put("dict", Map.of());
            return ApiResult.ok(out);
        }
        out.put("dict", translations.translate(locale, keys));
        return ApiResult.ok(out);
    }
}
