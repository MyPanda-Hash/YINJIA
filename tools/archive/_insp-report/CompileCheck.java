import net.sf.jasperreports.engine.JasperCompileManager;

public class CompileCheck {
    public static void main(String[] args) throws Exception {
        String path = args[0];
        try {
            JasperCompileManager.compileReport(path);
            System.out.println("COMPILE_OK");
        } catch (Throwable t) {
            System.out.println("COMPILE_FAIL: " + t.getMessage());
            Throwable c = t;
            while (c.getCause() != null && c.getCause() != c) c = c.getCause();
            System.out.println("ROOT_CAUSE: " + c.getClass().getName() + ": " + c.getMessage());
            if (c.getMessage() != null && c.getMessage().length() < 400) {
                c.printStackTrace(System.out);
            }
            System.exit(1);
        }
    }
}
