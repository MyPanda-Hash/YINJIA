package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PortalNotificationService;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 门户角标与通知(对齐 light-mes PortalController 契约,数据来自 HSDZ_MES) */
@RestController
@RequestMapping("/api/portal")
public class PortalController {

    private final PortalNotificationService notificationService;

    public PortalController(PortalNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/badge")
    public ApiResult<Map<String, Integer>> badge(Authentication authentication) {
        String user = authentication == null ? "" : authentication.getName();
        return ApiResult.ok(notificationService.badge(user));
    }

    private static final Map<String, List<Map<String, Object>>> NOTICES = buildNotices();

    private static Map<String, List<Map<String, Object>>> buildNotices() {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", 1);
        n.put("type", "notice");
        n.put("title", "YINJIA-MES v0.2 上线公告");
        n.put("titleEn", "YINJIA-MES v0.2 Release Announcement");
        n.put("time", "2026-08-29 15:00");
        n.put("read", true);
        n.put("content", "本版本同步 light-mes 最新引擎:扫描填单(OCR)、面板运行时注入、审批组归一化、"
                + "现存量回填(库存台账 kucun)与通知中心。");
        n.put("contentEn", "This release syncs the latest light-mes engine: scan-to-fill (OCR), panel runtime "
                + "injection, approval group normalization, on-hand backfill (inventory ledger kucun), "
                + "and the notification center.");
        Map<String, List<Map<String, Object>>> m = new LinkedHashMap<>();
        m.put("notice", List.of(n));
        return m;
    }

    @GetMapping("/notice/list")
    public ApiResult<List<Map<String, Object>>> noticeList(
            @RequestParam(defaultValue = "todo") String type, Authentication authentication) {
        if ("notice".equals(type)) {
            boolean en = LocaleContextHolder.getLocale() != null
                    && "en".equalsIgnoreCase(LocaleContextHolder.getLocale().getLanguage());
            List<Map<String, Object>> out = new java.util.ArrayList<>();
            for (Map<String, Object> n : NOTICES.getOrDefault(type, List.of())) {
                Map<String, Object> localized = new LinkedHashMap<>(n);
                if (en) {
                    if (n.get("titleEn") != null) localized.put("title", n.get("titleEn"));
                    if (n.get("contentEn") != null) localized.put("content", n.get("contentEn"));
                }
                out.add(localized);
            }
            return ApiResult.ok(out);
        }
        String user = authentication == null ? "" : authentication.getName();
        return ApiResult.ok(notificationService.list(user, type));
    }
}
