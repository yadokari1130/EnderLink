// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import { contextBridge, ipcRenderer, shell } from 'electron'
import * as fs from "fs-extra";
import { join, basename, dirname } from "path";
import simpleGit from "simple-git";
import {execSync, exec} from "child_process"
import * as path from "path";
import * as child_process from "child_process";
import ngrok, { Listener } from "@ngrok/ngrok";
import * as os from "node:os";
import nbt, { NBTFormat } from "prismarine-nbt"
import StreamZip from "node-stream-zip"
import { Connection, install, bin, tunnel } from "cloudflared"
import { ChildProcess } from "child_process";
import sharp from "sharp";

let proc: child_process.ChildProcessWithoutNullStreams | null = null
let listener: Listener | null = null
let tunnelData: {url: Promise<string>, connections: Promise<Connection>[], child: ChildProcess, stop: ChildProcess["kill"]} | null = null
let accessProc: child_process.ChildProcessWithoutNullStreams | null = null

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: any, text: any) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

contextBridge.exposeInMainWorld("nbt", {
  parse: async (data: Buffer, nbtType: NBTFormat) => await nbt.parse(data, nbtType),
})

contextBridge.exposeInMainWorld("store", {
  get: (key: string) => ipcRenderer.invoke("store:get", {key: key}),
  set: (key: string, value: string) => ipcRenderer.invoke("store:set", {key: key, value: value})
})

contextBridge.exposeInMainWorld("file", {
  save: (filePath: string, text: string) => fs.writeFileSync(filePath, text, { encoding: 'utf-8' }),
  saveBin: (filePath: string, data: any) => fs.writeFileSync(filePath, Buffer.from(data), "binary"),
  saveServerIcon: async (imagePath: string, dirPath: string) => {
    let image = sharp(imagePath)
    await image.resize({
      width: 64,
      height: 64,
      fit: "contain",
      background: "#FFFFFF"
    })
        .toFormat("png")
        .toFile(path.join(dirPath, "server-icon.png"))
  },
  load: (filePath: string, encoding: BufferEncoding) => fs.readFileSync(filePath, {encoding: encoding}),
  loadBuffer: (filePath: string) => fs.readFileSync(filePath),
  exists: (filePath: string) => fs.pathExistsSync(filePath),
  join: (...paths: string[]) => join(...paths),
  selectPath: () => ipcRenderer.invoke("dialog:selectPath"),
  selectFilePath: (defaultPath: string) => ipcRenderer.invoke("dialog:selectFilePath", {defaultPath: defaultPath}),
  selectImagePath: (defaultPath: string) => ipcRenderer.invoke("dialog:selectImagePath", {defaultPath: defaultPath}),
  url: () => window.location.href,
  getUserDataPath: async (...paths: string[]) => join(await ipcRenderer.invoke("file:getUserDataPath"), ...paths),
  mkdir: (filePath: string) => {
    if (!fs.existsSync(filePath)) fs.mkdirSync(filePath)
  },
  rm: (filePath: string) => {
    if (fs.existsSync(filePath)) fs.removeSync(filePath)
  },
  cp: (src: string, dest: string, filter: (src: string, dest: string) => boolean) => fs.copySync(src, dest, {filter: filter}),
  mv: (src: string, dest: string) => fs.moveSync(src, dest),
  resolve: (filePath: string) => path.resolve(filePath),
  basename: (filePath: string) => basename(filePath),
  dirname: (filePath: string) => dirname(filePath),
  getAllChildren: (filePath: string) => fs.readdirSync(filePath),
  getMinecraftPath: (...paths: string[]) => {
    let result = ""
    let platform = process.platform
    if (platform === "win32")
      result = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), ".minecraft")
    else if (platform === "darwin")
      result = path.join(os.homedir(), "Library", "Application Support", "minecraft")
    else
      result = path.join(os.homedir(), ".minecraft")

    if (paths) result = path.join(result, ...paths)

    return result
  },
  stream: (filePath: string, onReady: (zip: StreamZip) => void) => {
    let zip = new StreamZip({file: filePath, storeEntries: true})
    zip.on("ready", () => {
      onReady(zip)
    })
  },
});

contextBridge.exposeInMainWorld("token", {
  getAccessToken: () => ipcRenderer.invoke("token:getAccessToken"),
  setAccessToken: (accessToken: string) => ipcRenderer.invoke("token:setAccessToken", {accessToken: accessToken}),
  logout: () => ipcRenderer.invoke("token:logout"),
})

contextBridge.exposeInMainWorld("ngrok", {
  getNgrokToken: () => ipcRenderer.invoke("ngrok:getNgrokToken"),
  setNgrokToken: (token: string) => ipcRenderer.invoke("ngrok:setNgrokToken", {token: token}),
  getUseNgrok: () => ipcRenderer.invoke("ngrok:getUseNgrok"),
  setUseNgrok: (useNgrok: boolean) => ipcRenderer.invoke("ngrok:setUseNgrok", {useNgrok: useNgrok}),
  // forward: (token: string, port: number) => ipcRenderer.invoke("ngrok:forward", {token: token, port: port}),
  forward: async (token: string, port: string) => {
    listener = await ngrok.forward({
      addr: `localhost:${port}`,
      authtoken: token,
      proto: "tcp"
    })
  },
  getUrl: () => listener?.url(),
  close: () => listener?.close(),
})

contextBridge.exposeInMainWorld("cloudflared", {
  getUseCloudflared: () => ipcRenderer.invoke("store:get", {key: "useCloudflared"}),
  setUseCloudflared: (useCloudflared: boolean) => ipcRenderer.invoke("store:set", {key: "useCloudflared", value: useCloudflared}),
  tunnel: async (port: string) => {
    tunnelData = tunnel({"--url": `tcp://localhost:${port}`})
    tunnelData?.child?.stdout?.on("data", (data: string) => console.log(Buffer.from(data, "utf-8").toString()))
    tunnelData?.child?.stderr?.on("data", (data: string) => console.log(Buffer.from(data, "utf-8").toString()))
    await Promise.all(tunnelData.connections)
    return await tunnelData.url
  },
  getUrl: async () => await tunnelData?.url,
  closeTunnel: () => tunnelData?.stop(),
  access: (url: string) => {
    accessProc = child_process.spawn(bin, ["access", "tcp", "--hostname", url, "--url", "localhost:25565"])
    accessProc?.stdout.on("data", (data: string) => console.log(Buffer.from(data, "utf-8").toString()))
    accessProc?.stderr.on("data", (data: string) => console.log(Buffer.from(data, "utf-8").toString()))
  },
  closeAccess: () => {
    accessProc?.kill()
    accessProc = null
  },
  getBin: () => bin,
  install: async () => await install(bin),
  isAccessing: () => !!accessProc
})

contextBridge.exposeInMainWorld("shell", {
  openExternal: (url: string) => shell.openExternal(url),
  showItemInFolder: (path: string) => shell.showItemInFolder(path),
  getPlatform: () => process.platform,
  openPath: (url: string) => shell.openPath(url)
})

contextBridge.exposeInMainWorld("server", {
  waitCallback: (url: string) => ipcRenderer.invoke("server:waitCallback", {url: url}),
  get: (url: string) => ipcRenderer.invoke("axios:get", {url: url}),
})

contextBridge.exposeInMainWorld("win", {
  focusWin: () => ipcRenderer.invoke("win:focusWin")
})

contextBridge.exposeInMainWorld("command", {
  execSync: (command: string) => execSync(command).toString(),
  exec: (command: string, onOut: (error: child_process.ExecException | null, stdout: string, stderr: string) => void) => exec(command, onOut),
  spawn: (command: string, path: string, onOut: (data: string) => void, onError: (data: string) => void, onClose: (code: number) => void) => {
    const c = command.split(" ")[0]
    const args = command.split(" ").splice(1)
    proc = child_process.spawn(c, args, {cwd: path, shell: true})
    proc.stdout.on("data", data => onOut(Buffer.from(data, "utf-8").toString()))
    proc.stderr.on("data", data => onError(Buffer.from(data, "utf-8").toString()))
    proc.on("close", onClose)
  },
  spawnSync: (command: string) => {
    const c = command.split(" ")[0]
    const args = command.split(" ").splice(1)
    let syncProc = child_process.spawnSync(c, args, {shell: true})

    return [syncProc.stdout?.toString(), syncProc.stderr?.toString(), syncProc.status]
  },
  write: (command: string) => {
    proc?.stdin.write(command + "\n")
  },
  kill: () => {
    proc?.kill(1)
  },
})

contextBridge.exposeInMainWorld("git", {
  init: async (path: string, email: string, username: string, origin: string) => {
    const git = simpleGit(path)
    await git.init()
    await git.raw("switch", "-c", "main")
    await git.addConfig("user.email", email)
    await git.addConfig("user.name", username)
    await git.addConfig("core.sshCommand", `ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519").replace(/\\/g, "\\\\")} -o IdentitiesOnly=true`)
    await git.addConfig("pull.rebase", "false")
    await git.addRemote("origin", origin)
  },
  upload: async (path: string, message: string) => {
    const git = simpleGit(path)
    await git.raw("add", "-A")
    await git.commit(message)
    await git.push("origin", "main")
  },
  download: async (path: string) => {
    const git = simpleGit(path)
    await git.pull("origin", "main")
  },
  forceDownload: async (path: string) => {
    const git = simpleGit(path)
    await git.fetch()
    await git.raw("reset", "--hard", "origin/main")
  },
  forceUpload: async (path: string, message: string) => {
    const git = simpleGit(path)
    await git.raw("add", "-A")
    await git.commit(message)
    await git.raw("push", "-f", "origin", "main")
  },
  clone: async (path: string, repoPath: string, url: string, email: string, username: string) => {
    let git = simpleGit(path, {config: [`core.sshCommand=ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519").replace(/\\/g, "\\\\")} -o IdentitiesOnly=true`]})
    await git.clone(url)
    git = simpleGit(repoPath)
    await git.addConfig("user.email", email)
    await git.addConfig("user.name", username)
    await git.addConfig("core.sshCommand", `ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519").replace(/\\/g, "\\\\")} -o IdentitiesOnly=true`)
  },
  log: async (path: string) => {
    let git = simpleGit(path)
    return git.log();
  },
  status: async (path: string) => {
    let git = simpleGit(path)
    return git.status()
  },
  commit: async (path: string, message: string) => {
    const git = simpleGit(path)
    await git.raw("add", "-A")
    await git.commit(message)
  },
  revert: async (path: string, hash: string) => {
    const git = simpleGit(path)
    await git.raw("revert", "-n", `${hash}...HEAD`)
  },
  rmCache: async (path: string) => {
    const git = simpleGit(path)
    await git.raw("rm", "-r", "--cached", ".")
  }
})