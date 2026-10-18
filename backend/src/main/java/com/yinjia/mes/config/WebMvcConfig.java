package com.yinjia.mes.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 把 {@link SlowRequestLogger} 挂到 {@code /api/**} 上(2026-10-18)。
 *
 * <p>只挂接口、不挂静态资源:静态 chunk 的耗时没有诊断价值,挂上去只会把日志刷满。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final SlowRequestLogger slowRequestLogger;

    public WebMvcConfig(SlowRequestLogger slowRequestLogger) {
        this.slowRequestLogger = slowRequestLogger;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(slowRequestLogger).addPathPatterns("/api/**");
    }
}
