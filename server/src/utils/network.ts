import { networkInterfaces } from "node:os";

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export function getLanIps() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item!.address);
  const privateAddresses = addresses.filter(isPrivateIPv4);
  return [...new Set(privateAddresses.length ? privateAddresses : addresses)];
}

export function isPrivateLanAddress(address: string) {
  return isPrivateIPv4(address);
}
