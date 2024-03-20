// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import { contextBridge, ipcRenderer, shell } from 'electron'
import * as fs from "fs";
import { join } from "path";
import simpleGit from "simple-git";
import {execSync} from "child_process"
import * as path from "path";
import * as child_process from "child_process";
import ngrok, { Listener } from "@ngrok/ngrok";

let proc: child_process.ChildProcessWithoutNullStreams | null = null
let listener: Listener | null = null

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: any, text: any) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

contextBridge.exposeInMainWorld("file", {
  save: (filePath: string, text: string) => fs.writeFileSync(filePath, text, { encoding: 'utf-8' }),
  load: (filePath: string, encoding: BufferEncoding) => fs.readFileSync(filePath, {encoding: encoding}),
  exists: (filePath: string) => fs.existsSync(filePath),
  join: (...paths: string[]) => join(...paths),
  selectPath: () => ipcRenderer.invoke("dialog:selectPath"),
  url: () => window.location.href,
  getUserDataPath: async (...paths: string[]) => join(await ipcRenderer.invoke("file:getUserDataPath"), ...paths),
  mkdir: (filePath: string) => {
    if (!fs.existsSync(filePath)) fs.mkdirSync(filePath)
  },
  rm: (filePath: string) => {
    if (fs.existsSync(filePath)) fs.rmSync(filePath)
  },
  rmDir: (dirPath: string) => {
    if (fs.existsSync(dirPath)) fs.rmSync(dirPath, {recursive: true})
  },
  resolve: (filePath: string) => path.resolve(filePath)
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

contextBridge.exposeInMainWorld("shell", {
  openExternal: (url: string) => shell.openExternal(url),
  showItemInFolder: (path: string) => shell.showItemInFolder(path)
})

contextBridge.exposeInMainWorld("server", {
  waitCallback: (url: string) => ipcRenderer.invoke("server:waitCallback", {url: url})
})

contextBridge.exposeInMainWorld("win", {
  focusWin: () => ipcRenderer.invoke("win:focusWin")
})

contextBridge.exposeInMainWorld("command", {
  execSync: (command: string) => execSync(command).toString(),
  spawn: (command: string, path: string, onOut: (data: string) => void, onError: (data: string) => void, onClose: (code: number) => void) => {
    const c = command.split(" ")[0]
    const args = command.split(" ").splice(1)
    proc = child_process.spawn(c, args, {cwd: path, shell: true})
    proc.stdout.on("data", data => onOut(Buffer.from(data, "utf-8").toString()))
    proc.stderr.on("data", data => onError(Buffer.from(data, "utf-8").toString()))
    proc.on("close", onClose)
  },
  write: (command: string) => {
    proc?.stdin.write(command + "\n")
  },
  kill: () => {
    proc?.kill(1)
  }
})

contextBridge.exposeInMainWorld("git", {
  init: async (path: string, email: string, username: string, origin: string) => {
    const git = simpleGit(path)
    await git.init()
    // await git.checkout("main", {"-b": null})
    await git.raw("switch", "-c", "main")
    await git.addConfig("user.email", email)
    await git.addConfig("user.name", username)
    await git.addConfig("core.sshCommand", `ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519")} -o IdentitiesOnly=true`)
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
    let git = simpleGit(path, {config: [`core.sshCommand=ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519")} -o IdentitiesOnly=true`]})
    await git.clone(url)
    git = simpleGit(repoPath)
    await git.addConfig("user.email", email)
    await git.addConfig("user.name", username)
    await git.addConfig("core.sshCommand", `ssh -i ${join(await ipcRenderer.invoke("file:getUserDataPath"), "ssh", "id_ed25519")} -o IdentitiesOnly=true`)
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
  }
})