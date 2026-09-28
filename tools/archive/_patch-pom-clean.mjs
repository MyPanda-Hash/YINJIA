// _patch-pom-clean.mjs — 临时:clean 排除被锁 jar(spring-boot repackage 直接覆盖写新 jar)
import fs from 'node:fs';
const p = 'backend/pom.xml';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('maven-clean-plugin')) { console.log('已打过补丁'); process.exit(0); }
const inj = `    <plugins>
      <!-- 2026-09-24 临时:clean 排除被占 jar(用户 bat 循环持锁);spring-boot repackage 会覆盖写新 jar -->
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-clean-plugin</artifactId>
        <configuration>
          <excludeDefaultDirectories>true</excludeDefaultDirectories>
          <filesets>
            <fileset>
              <directory>\${project.build.directory}</directory>
              <excludes>
                <exclude>yinjia-mes-backend-0.1.0.jar</exclude>
              </excludes>
            </fileset>
          </filesets>
        </configuration>
      </plugin>
`;
if (!s.includes('    <plugins>')) { console.log('未找到 <plugins>'); process.exit(1); }
s = s.replace('    <plugins>', inj);
fs.writeFileSync(p, s, 'utf8');
console.log('✅ pom clean 排除已加');
