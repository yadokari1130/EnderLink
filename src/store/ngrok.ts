import { defineStore } from 'pinia';
import {INgrok} from "../@types/global";

export const useNgrokStore = defineStore("ngrok", {
    state: () => ({
        ngrokToken: "",
        useNgrok: false,
    } as {
        ngrokToken: string,
        useNgrok: boolean
    }),
    actions: {
        async fetchData(window: Window) {
            this.ngrokToken = await window.ngrok.getNgrokToken()
            this.useNgrok = await window.ngrok.getUseNgrok()
        },
        async save(window: Window) {
            await window.ngrok.setNgrokToken(this.ngrokToken)
            await window.ngrok.setUseNgrok(this.useNgrok)
        }
    }
});