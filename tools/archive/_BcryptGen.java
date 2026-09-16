import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
public class _BcryptGen {
  public static void main(String[] a) { System.out.println(new BCryptPasswordEncoder().encode(a[0])); }
}
