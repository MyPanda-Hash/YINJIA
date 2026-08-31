package com.yinjia.mes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class MesApplication {

    public static void main(String[] args) {
        SpringApplication.run(MesApplication.class, args);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** 首次启动时若无用户则种子 admin/123456(BCrypt),与 light-mes 初始账号一致 */
    @Bean
    public ApplicationRunner adminSeeder(JdbcTemplate jdbc, PasswordEncoder encoder) {
        return args -> {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM yj_user", Integer.class);
            if (count == null || count == 0) {
                jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin) VALUES (?,?,?,?)",
                        "admin", encoder.encode("123456"), "系统管理员", "Y");
                System.out.println("[YINJIA-MES] 已种子初始账号 admin/123456");
            }
        };
    }
}
