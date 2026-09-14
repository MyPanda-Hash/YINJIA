package com.yinjia.mes.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.HashMap;
import java.util.Map;

/**
 * 双账套数据源(ADR-0003):
 *   YJ      → spring.datasource          → HSDZ_MES(正式)
 *   YJ_TEST → yinjia.test-datasource     → HSDZ_MES_TEST(测试)
 * 主 Bean 是按登录工厂路由的路由数据源;每账套独立 Hikari 连接池(各 10 连接)。
 * 无路由上下文的线程(启动播种/定时任务等)默认走正式库。
 */
@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties prodDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("yinjia.test-datasource")
    public DataSourceProperties testDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSourceRouter dataSource(DataSourceProperties prodDataSourceProperties,
                                       DataSourceProperties testDataSourceProperties) {
        HikariDataSource prod = prodDataSourceProperties.initializeDataSourceBuilder()
                .type(HikariDataSource.class).build();
        prod.setMaximumPoolSize(10);
        prod.setPoolName("HSDZ_MES-prod");
        HikariDataSource test = testDataSourceProperties.initializeDataSourceBuilder()
                .type(HikariDataSource.class).build();
        test.setMaximumPoolSize(10);
        test.setPoolName("HSDZ_MES_TEST-test");

        DataSourceRouter router = new DataSourceRouter();
        Map<Object, Object> targets = new HashMap<>();
        targets.put(DataSourceRouter.PROD, prod);
        targets.put(DataSourceRouter.TEST, test);
        router.setTargetDataSources(targets);
        router.setDefaultTargetDataSource(prod);
        return router;
    }
}
