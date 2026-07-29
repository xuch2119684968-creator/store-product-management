const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("storeDesktop", Object.freeze({ isDesktop: true }));
