package com.yinjia.mes.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/**
 * 前端静态资源的**缓存策略**收口(2026-10-15)。
 *
 * <p><b>为什么需要它(用户报障「前端还是没有更新」)</b>:后端确实换了新前端 ——
 * 实测磁盘真源 / 服务端返回 / 全新无痕 profile 打开 8090 三方一致(PanelxList chunk MD5 相同、
 * 三面板左栏配置俱在),但用户在**日常浏览器**里看到的仍是旧界面。
 * 根因不在服务端而在缓存:浏览器把入口 {@code index.html} 一起缓存了,而 index.html 里引用的是
 * **带内容哈希的 chunk 文件名** —— index.html 一旦命中缓存,页面就继续按旧哈希去取旧 chunk,
 * 新前端永远不会被下载。**只重建 jar / 重启服务都治不好,因为请求根本没发出去。**
 *
 * <p><b>策略(两条互为前提)</b>:
 * <ol>
 *   <li>入口文档 {@code index.html}(无哈希、内容引用别的文件名)⇒ {@code no-cache}:
 *       允许存副本但**每次必须回源校验**,未变走 304 零流量,一变立刻生效;</li>
 *   <li>带哈希的产物 {@code /assets/**} ⇒ 长期缓存(由 application.yml 的
 *       {@code spring.web.resources.cache} 给 {@code max-age=365d, public})。
 *       文件名即版本,内容绝不会在同一个 URL 下变化,可放心长缓存 —— 这是首屏性能的关键
 *       (element-plus 单文件 905KB,每次重下会明显变慢)。</li>
 * </ol>
 *
 * <p><b>为什么用 addResourceHandlers 而不是 Filter</b>(2026-10-15 实测踩坑):
 * 先写的版本是 {@code OncePerRequestFilter},在 chain 前后都试过 setHeader —— 均**无效**:
 * Spring 的 {@code ResourceHttpRequestHandler} 在处理时会把
 * {@code spring.web.resources.cache} 的 Cache-Control **整个 set 一遍**(覆盖掉过滤器写的值),
 * 实测响应里只剩它自己的 {@code max-age=31536000, public}。
 * 而注册 resource handler 时显式 {@code setCacheControl},是 RequestHandler **自己写头**,
 * 不存在被覆盖的问题 —— 这才是 Spring 的既有机制。
 *
 * <p><b>为什么是 {@code /**} 而不是 {@code /index.html}</b>:接口里 path pattern 用
 * {@code /**}("拦截静态资源处理器"),{@code addResourceLocations} 再限定到静态根目录;
 * 该 handler 优先级低于已有接口映射,故不会抢 {@code /api/**} 等路由。
 */
@Configuration
public class WebCacheConfig implements WebMvcConfigurer {

    /** 项目前端由 Vite 构建、产物落在 classpath:/static(打包进 jar 的 BOOT-INF/classes/static) */
    private static final String STATIC_LOCATIONS = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // ⚠ 只登记入口文档这一条,**不**接管 /assets/**(那部分交给 Spring Boot 默认资源链 +
        //   application.yml 的 max-age=365d,免得多一条 handler 去抢它的匹配)。
        //   入口文档必须回源校验:它引用的是哈希文件名,缓存住 = 钉死旧前端。
        registry.addResourceHandler("/", "/index.html")
                .addResourceLocations(STATIC_LOCATIONS)
                .setCacheControl(CacheControl.noCache().mustRevalidate());

        // 兜底:index.html 之外的**无哈希**顶层文档(favicon 等)也用短缓存,
        // 避免它们被 application.yml 的全局 365d 钉住(图标换了看不到)。
        // 注意 /assets/** 不在其中 —— 那些带哈希,应走长缓存。
        registry.addResourceHandler("/favicon.svg", "/favicon.ico")
                .addResourceLocations(STATIC_LOCATIONS)
                .setCacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic());
    }
}
