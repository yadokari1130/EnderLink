import axios from "axios";

export class Player {
    name: string = ""
    uuid: string = ""
    avatarUrl: string = ""

    constructor(name: string, uuid: string, avatarUrl: string) {
        this.name = name
        this.uuid = uuid
        this.avatarUrl = avatarUrl
    }

    static async build(params: {name?: string, uuid?: string}, window: Window) {
        if (!params.name && !params.uuid) return null
        let name = params.name || await Player.getName(params.uuid, window)
        let uuid = params.uuid || await Player.getUuid(params.name, window)
        let avatarUrl = `https://mc-heads.net/avatar/${uuid}/64/`

        return new Player(name, uuid, avatarUrl)
    }

    static async getUuid(name: string, window: Window) {
        let data: {id: string}
        try {
            data = JSON.parse(await window.server.get(`https://api.mojang.com/users/profiles/minecraft/${name}/`))
        } catch (error) {
            console.error(error)
        }

        if (!data || !data.id) return null

        return `${data.id.substring(0, 8)}-${data.id.substring(8, 12)}-${data.id.substring(12, 16)}-${data.id.substring(16, 20)}-${data.id.substring(20, 32)}`
    }

    static async getName(uuid: string, window: Window) {
        let data: {name: string}
        try {
            data = JSON.parse(await window.server.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}/`))
        } catch (error) {
            console.error(error)
        }

        if (!data || !data.name) return null

        return data.name
    }
}