// QGenHash.java —— 生成 bcrypt 口令哈希(仅为走查创建临时账号用;不写任何库)
// 用法: java -cp <spring-security-crypto.jar> archive\_role-view-20261113\QGenHash.java <明文>
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class QGenHash {
    public static void main(String[] a) {
        String plain = a.length > 0 ? a[0] : "Tmp#FieldView2026";
        String hash = new BCryptPasswordEncoder().encode(plain);
        System.out.println("plain=" + plain);
        System.out.println("hash=" + hash);
        System.out.println("verify=" + new BCryptPasswordEncoder().matches(plain, hash));
    }
}
