import { defineStore } from 'pinia';
import {ServerData} from "../components/ServerCard.vue"
import { useGitHubStore } from "./github";
import { useNgrokStore } from "./ngrok";
import { Listener } from "@ngrok/ngrok"
import { useCloudflaredStore } from "./cloudflared";

export const useRunningStore = defineStore("running", {
    state: () => ({
        log: "",
        serverData: null,
        icon: null,
        isRunning: false,
        code: null,
        status: "停止済み",
        ngrokStore: useNgrokStore(),
        url: null,
        cloudflaredStore: useCloudflaredStore()
    } as {
        log: string,
        serverData: ServerData | null,
        icon: string | null,
        isRunning: boolean
        code: number | null,
        status: "停止済み" | "終了中" | "起動中" | "エラー",
        ngrokStore: any,
        url: string | null | undefined,
        cloudflaredStore: any
    }),
    actions: {
        add(text: string) {
            this.log += text
        },
        async run(serverData: ServerData, icon: string, window: Window): Promise<"#runningError" | "#downloadError" | "#loadError" | "#githubError" | "#saveError" | "#uploadError" | "#cloudflaredError" | string | undefined> {
            if (this.isRunning) return "#runningError"

            this.isRunning = true
            this.status = "起動中"
            const githubStore = useGitHubStore()
            try {
                await window.git.download(serverData.path)
            }
            catch (error) {
                console.log(error)
                this.isRunning = false
                this.status = "エラー"
                return "#downloadError"
            }
            const statusPath = window.file.join(serverData.path, "status.txt")
            let status = ""
            try {
                status = window.file.load(statusPath, "utf-8")
                status = status.replace("\n", "")
            }
            catch (error) {
                console.log(error)
                this.isRunning = false
                this.status = "エラー"
                return "#loadError"
            }

            if (status !== "#stopping") {
                this.isRunning = false
                this.status = "エラー"
                return status
            }
            if (!githubStore.userData?.login) {
                this.isRunning = false
                this.status = "エラー"
                return "#githubError"
            }

            if (this.cloudflaredStore.useCloudflared) {
                try {
                    let port = window.file.load(window.file.join(serverData?.path || "", "server.properties"), "utf-8")
                    let matched = port.match(/server-port=([0-9]+)/)
                    if (!matched || !matched[1]) return "#loadError"

                    this.url = (await window.cloudflared.tunnel(matched[1])).replace("https://", "")
                }
                catch (error) {
                    console.log(error)
                    this.isRunning = false
                    this.status = "エラー"
                    return "#cloudflaredError"
                }
            }

            try {
                window.file.save(statusPath, githubStore.userData?.login)
            }
            catch (error) {
                console.log(error)
                this.isRunning = false
                this.status = "エラー"
                return "#saveError"
            }

            try {
                await window.git.upload(serverData.path, "サーバー起動")
            }
            catch (error) {
                console.log(error)
                this.isRunning = false
                this.status = "エラー"
                return "#uploadError"
            }

            this.log = ""
            this.serverData = serverData
            this.icon = icon

            let command = `java -Xmx${serverData.maxMem}M -Xms${serverData.minMem}M `
            command += this.serverData.args
            command += ` -jar ${serverData.jarPath}`
            command += " nogui"

            console.log(command)

            window.command.spawn(command, serverData.path,
                data => this.add(data),
                data => this.add(data),
                async code => {
                    this.status = "終了中"
                    if (this.cloudflaredStore.useCloudflared) window.cloudflared.closeTunnel()
                    window.file.save(statusPath, "#stopping")
                    await window.git.upload(serverData.path, "サーバー終了")

                    this.status = "停止済み"
                    this.isRunning = false
                    this.code = code
                }
            )
        },
        async stop(path: string, window: Window) {
            if (this.isRunning) return

            window.file.save(window.file.join(path, "status.txt"), "#stopping")
            await window.git.upload(path, "サーバー終了")
        }
    }
});