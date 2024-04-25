import { defineStore } from 'pinia';
import {INgrok} from "../@types/global";

export const useCloudflaredStore = defineStore("cloudflared", {
    state: () => ({
        useCloudflared: false,
        cloudflaredVersion: null,
        isAccessing: false
    } as {
        useCloudflared: boolean,
        cloudflaredVersion: string | null
        isAccessing: boolean
    }),
    actions: {
        async fetchData(window: Window) {
            this.useCloudflared = await window.cloudflared.getUseCloudflared()
            console.log(window.cloudflared.getBin())
            try {
                this.cloudflaredVersion = window.command.execSync(`${window.cloudflared.getBin()} --version`)
            }
            catch {
                this.cloudflaredVersion = null
            }
        },
        async save(window: Window) {
            await window.cloudflared.setUseCloudflared(this.useCloudflared)
        },
        access(accessUrl: string, window: Window) {
            window.cloudflared.access(accessUrl)
            this.isAccessing = true
        },
        closeAccess(window: Window) {
            window.cloudflared.closeAccess()
            this.isAccessing = false
        }
    }
});