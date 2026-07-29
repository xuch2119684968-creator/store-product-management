const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("node:path");

const systemUrl = process.env.STORE_MANAGEMENT_URL || "https://store-product-management-ben1.onrender.com";
const trustedOrigin = new URL(systemUrl).origin;

function isTrustedSystemUrl(value) {
  try {
    return new URL(value).origin === trustedOrigin;
  } catch {
    return false;
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 390,
    minHeight: 620,
    title: "商品管理系统",
    backgroundColor: "#f8fafc",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedSystemUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  window.once("ready-to-show", () => window.show());
  void window.loadURL(systemUrl);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  Menu.setApplicationMenu(null);
  app.setAboutPanelOptions({ applicationName: "商品管理系统", version: app.getVersion() });
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
