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
            this.cloudflaredVersion = window.command.execSync(`${window.cloudflared.getBin()} --version`)
        },
        async save(window: Window) {
            await window.cloudflared.setUseCloudflared(this.useCloudflared)
        },
        access(window: Window) {
            window.cloudflared.access(this.accessUrl)
            this.isAccessing = true
        },
        closeAccess(window: Window) {
            window.cloudflared.closeAccess()
            this.isAccessing = false
        }
    }
});