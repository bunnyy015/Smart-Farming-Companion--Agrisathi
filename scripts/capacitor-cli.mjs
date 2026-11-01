import os from "node:os";

// Some Windows environments can throw from os.userInfo(), which Capacitor's
// CLI calls before it parses a command. Keep the normal implementation and
// fall back to the current account details only when that call fails.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    username: process.env.USERNAME || "",
    uid: -1,
    gid: -1,
    shell: process.env.COMSPEC || "cmd.exe",
    homedir: process.env.USERPROFILE || process.cwd(),
  });
}

process.argv = [process.argv[0], "capacitor", ...process.argv.slice(2)];
const { run } = await import("@capacitor/cli");
run();
