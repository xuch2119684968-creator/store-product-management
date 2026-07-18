import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function getLanIps() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
  const privateAddresses = addresses.filter(isPrivateIPv4);
  return [...new Set(privateAddresses.length ? privateAddresses : addresses)];
}

const lanIps = getLanIps();
const port = 5173;

console.log("\n商品管理系统正在启动（局域网模式）…");
if (lanIps.length) {
  console.log("手机与电脑连接同一 Wi-Fi 后，请访问：");
  lanIps.forEach((ip) => console.log("  http://" + ip + ":" + port));
} else {
  console.log("未自动识别到局域网 IPv4 地址。请检查 Wi-Fi 连接后重试。");
}
console.log("");

const children = [
  spawn("npm", ["run", "dev", "--prefix", "server"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev", "--prefix", "client"], { stdio: "inherit" })
];

function stop(signal) {
  children.forEach((child) => {
    if (!child.killed) child.kill(signal);
  });
}

process.on("SIGINT", () => {
  stop("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop("SIGTERM");
  process.exit(0);
});

children.forEach((child) => {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop("SIGTERM");
      process.exitCode = code;
    }
  });
});
