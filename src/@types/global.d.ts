import { SimpleGit } from "simple-git";
import { Listener } from "@ngrok/ngrok";
import { ChildProcess } from "concurrently/dist/src/command";
import * as child_process from "child_process";

declare global {
    interface Window {
        store: IStore
        file: IFile
        token: IToken
        shell: IShell
        server: IServer
        win: IWin
        command: ICommand
        git: IGit
        ngrok: INgrok
    }
}

export interface IFile {
    save: (filePath: string, text: string) => void
    saveBin: (filePath: string, data: any) => void
    load: (filePath: string, encoding: BufferEncoding) => string
    exists: (filePath: string) => boolean
    join: (...paths: string[]) => string
    selectPath: () => Promise<any>
    selectFilePath: (defaultPath: string) => Promise<any>
    url: () => string
    getUserDataPath: (...paths: string[]) => Promise<string>
    mkdir: (filePath: string) => void
    rm: (filePath: string) => void
    resolve: (filePath: string) => string
    rmDir: (dirPath: string) => void
    basename: (filePath: string) => string
    dirname: (filePath: string) => string,
}

export interface IToken {
    getAccessToken: () => Promise<any>
    setAccessToken: (accessToken: string) => Promise<any>
    logout: () => Promise<any>
}

export interface INgrok {
    getNgrokToken: () => Promise<any>
    setNgrokToken: (token: string) => Promise<any>
    getUseNgrok: () => Promise<any>
    setUseNgrok: (useNgrok: boolean) => Promise<any>
    forward: (token: string, port: string) => Promise<Listener>
    getUrl: () => Promise<string | null>
    close: () => Promise<any>
}

export interface IShell {
    openExternal: (url: string) => Promise<void>
    showItemInFolder: (path: string) => void
    getPlatform: () => "aix" | "android" | "darwin" | "freebsd" | "haiku" | "linux" | "openbsd" | "sunos" | "win32" | "cygwin" | "netbsd"
    openPath: (url: string) => Promise<string>
}

export interface IServer {
    waitCallback: (url: string) => Promise<any>
}

export interface IWin {
    focusWin: () => Promise<any>
}

export interface IStore {
    get: (key: string) => Promise<string>
    set: (key: string, value: string) => Promise<void>
}

export interface ICommand {
    execSync: (command: string) => string
    exec: (command: string, onOut: (error: child_process.ExecException, stdout: string, stderr: string) => void) => ChildProcess
    spawn: (command: string, path: string, onOut: (data: string) => void, onError: (data: string) => void, onClose: (code: number) => void) => void
    write: (command: string) => void
    kill: () => void
}

export interface IGit {
    init: (path: string, email: string, username: string, origin: string) => Promise<void>
    upload: (path: string, message: string) => Promise<void>
    download: (path: string) => Promise<void>
    forceDownload: (path: string) => Promise<void>
    forceUpload: (path: string, message: string) => Promise<void>
    clone: (path: string, repoPath: string, url: string, email: string, username: string) => Promise<void>
    log: (path: string) =>  Promise<SimpleGit & Promise<resp.LogResult<types.DefaultLogFields>>>
    status: (path: string) => Promise<SimpleGit & Promise<resp.StatusResult>>
    commit: (path: string, message: string) => Promise<void>
    revert: (path: string, hash: string) => Promise<void>
}