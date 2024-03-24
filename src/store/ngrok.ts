import { defineStore } from 'pinia';
import {INgrok} from "../@types/global";

export const useNgrokStore = defineStore("ngrok", {
    state: () => ({
        ngrokToken: "",
        useNgrok: false,
        ngrokVersion: null
    } as {
        ngrokToken: string,
        useNgrok: boolean,
        ngrokVersion: string | null
    }),
    actions: {
        async fetchData(window: Window) {
            this.ngrokToken = await window.ngrok.getNgrokToken()
            this.useNgrok = await window.ngrok.getUseNgrok()
        },
        async save(window: Window) {
            await window.ngrok.setNgrokToken(this.ngrokToken)
            await window.ngrok.setUseNgrok(this.useNgrok)
        },
        async init(window: Window) {
            try {
                this.ngrokVersion = window.command.execSync("ngrok --version")
            }
            catch (error) {
                console.log(error)
                this.ngrokVersion = null
            }

            if (!this.ngrokVersion) {
                this.useNgrok = false
                await this.save(window)
            }
        }
    }
});