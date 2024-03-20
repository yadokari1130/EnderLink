import { defineStore } from 'pinia';
import {ServerData} from "../components/ServerCard.vue"

export const useServerSettingsStore = defineStore("serverSettings", {
    state: (): {
        serverData: ServerData | null,
        deleted: boolean
    } => ({
        serverData: null,
        deleted: false
    })
});