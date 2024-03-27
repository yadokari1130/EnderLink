import { join } from 'path';
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import express from 'express';
import ElectronStore from "electron-store";
import {autoUpdater} from "electron-updater";
import * as http from "http";

interface StoreType {
    access_token: Buffer | undefined,
    ngrok_token: Buffer | undefined,
    use_ngrok: boolean
}

const store = new ElectronStore<StoreType>()
let server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | null = null

const isDev = process.env.npm_lifecycle_event === "app:dev";
let mainWindow: BrowserWindow

async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: "Open File" })
    if (!canceled) {
        return filePaths[0]
    }
}

function handleSelectPath() {
    return dialog.showOpenDialogSync({
        properties: ["openDirectory"],
        title: "サーバーフォルダを選択",
        defaultPath: '.',
    });
}

function selectFilePath(defaultPath: string) {
    return dialog.showOpenDialogSync({
        title: "ファイルを選択",
        defaultPath: defaultPath
    })
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
            nodeIntegration: true,
        },
    });
    // mainWindow.removeMenu()
    if (getStore("windowMaximize") === "true") mainWindow.maximize()

    // and load the index.html of the app.
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');// Open the DevTools.
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(join(__dirname, '../../index.html'));
    }
    // mainWindow.loadURL( //this doesn't work on macOS in build and preview mode
    //     isDev ?
    //     'http://localhost:3000' :
    //     join(__dirname, '../../index.html')
    // );
}

autoUpdater.on("update-downloaded", ({ version, files, path, sha512, releaseName, releaseNotes, releaseDate }) => {
    const dialogOpts: {
        type: "info",
        buttons: string[],
        message: string,
        detail: string
    } = {
        type: "info",
        buttons: ["再起動", "後で"],
        message: "新しいバージョンが利用可能です。再起動でアップデートが適用されます。",
        detail: `${app.getName()} ${version} ${releaseDate}`
    }

    dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
            autoUpdater.quitAndInstall()
        }
    })

    autoUpdater.on("error", error => {
        console.log(error);
    })
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    ipcMain.handle('dialog:openFile', handleFileOpen)
    ipcMain.handle("dialog:selectPath", handleSelectPath)
    ipcMain.handle("dialog:selectFilePath", (event, args) => selectFilePath(args.defaultPath))
    ipcMain.handle("server:waitCallback", (event, args) => waitCallback(args.url))
    ipcMain.handle("win:focusWin", focusWin)
    ipcMain.handle("file:getUserDataPath", getUserDataPath)
    ipcMain.handle("token:getAccessToken", getAccessToken)
    ipcMain.handle("token:setAccessToken", (event, args) => setAccessToken(args.accessToken))
    ipcMain.handle("token:logout", logout)
    ipcMain.handle("ngrok:getNgrokToken", getNgrokToken)
    ipcMain.handle("ngrok:setNgrokToken", (event, args) => setNgrokToken(args.token))
    ipcMain.handle("ngrok:getUseNgrok", getUseNgrok)
    ipcMain.handle("ngrok:setUseNgrok", (event, args) => setUseNgrok(args.useNgrok))
    ipcMain.handle("store:get", (event, args) => getStore(args.key))
    ipcMain.handle("store:set", (event, args) => setStore(args.key, args.value))
    createWindow()
    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
});

app.on("ready", () => {
    autoUpdater.checkForUpdatesAndNotify();
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on("child-process-gone", (event, details) => {
    console.log(details.reason, details.name, details.exitCode)
})

async function waitCallback(url: string) {
    const { protocol, hostname, port, pathname } = new URL(url)
    if (protocol !== "http:" || hostname !== "localhost") throw new Error("URL error");

    if (server) return 

    return new Promise((resolve, reject) => {
        const app = express();
        app.get(pathname, async (req, res) => {
            resolve(req.query);
            res.send('<html><body><h1>この画面を閉じ、アプリに戻って操作を続けてください</h1></body></html>');
            setTimeout(shutdown, 100)
        });
        server = app.listen(port);
        const shutdown = (reason: string) => {
            server?.close()
            server = null
            if (reason) reject(new Error(reason));
        };
    });
}

function focusWin() {
    if (mainWindow) mainWindow.focus()
}

function getUserDataPath() {
    return app.getPath("userData")
}

function getAccessToken() {
    const encrypted = store.get("access_token")
    // @ts-ignore
    return encrypted ? safeStorage.decryptString(Buffer.from(encrypted.data)) : undefined
}

function setAccessToken(accessToken: string) {
    const encrypted = safeStorage.encryptString(accessToken)
    store.set("access_token", encrypted)
}

function logout() {
    store.delete("access_token")
}

function getNgrokToken() {
    const encrypted = store.get("ngrok_token")
    // @ts-ignore
    return encrypted ? safeStorage.decryptString(Buffer.from(encrypted.data)) : ""
}

function setNgrokToken(token: string) {
    const encrypted = safeStorage.encryptString(token)
    store.set("ngrok_token", encrypted)
}

function getUseNgrok() {
    return store.get("use_ngrok")
}

function setUseNgrok(useNgrok: boolean) {
    store.set("use_ngrok", useNgrok)
}

function getStore(key: string) {
    return store.get(key)
}

function setStore(key: string, value: string) {
    store.set(key, value)
}