import {IFile} from "../@types/global";
import * as timers from "timers";

interface IProperties {
    [key: string]: {
        value: string | number | boolean,
        type: any,
        description: string,
        limit?: Array<number>,
        selection?: Array<any>
    }
}

const defaults: IProperties = {
    "allow-flight": {
        value: false,
        type: Boolean,
        description: "飛行を許可します\nクリエイティブモードのプレイヤーは影響を受けません"
    },
    "allow-nether": {
        value: true,
        type: Boolean,
        description: "プレイヤーがネザーに行くことを許可します"
    },
    "broadcast-console-to-ops": {
        value: true,
        type: Boolean,
        description: "アプリから実行したコマンドの結果をOP権限を持つプレイヤーに表示します"
    },
    "broadcast-rcon-to-ops": {
        value: true,
        type: Boolean,
        description: "RCONから実行したコマンドの結果をOP権限を持つプレイヤーに表示します"
    },
    "difficulty": {
        value: "easy",
        type: String,
        description: "サーバーの難易度です",
        selection: [
            {title: "ピースフル", value: "peaceful"},
            {title: "イージー", value: "easy"},
            {title: "ノーマル", value: "normal"},
            {title: "ハード", value: "hard"}
        ]
    },
    "enable-command-block": {
        value: false,
        type: Boolean,
        description: "コマンドブロックを有効にします"
    },
    "enable-jmx-monitoring": {
        value: false,
        type: Boolean,
        description: "ミリ秒単位のTickを公開します"
    },
    "enable-rcon": {
        value: false,
        type: Boolean,
        description: "RCONを有効にします"
    },
    "sync-chunk-writes": {
        value: true,
        type: Boolean,
        description: "同時チャンク書き込みを有効にします"
    },
    "enable-status": {
        value: true,
        type: Boolean,
        description: "サーバーをMinecraft内でオンラインとして表示します\nオフにするとオフラインとして表示されますが、サーバーに参加することはできます"
    },
    "enable-query": {
        value: false,
        type: Boolean,
        description: "サーバーに関する情報の取得を許可します"
    },
    "entity-broadcast-range-percentage": {
        value: 100,
        type: Number,
        description: "エンティティを表示する範囲を設定します",
        limit: [0, 500]
    },
    "force-gamemode": {
        value: false,
        type: Boolean,
        description: "参加時にデフォルトのゲームモードに変更します"
    },
    "function-permission-level": {
        value: 2,
        type: Number,
        description: "関数の権限レベルを設定します",
        limit: [1, 4]
    },
    "gamemode": {
        value: "survival",
        type: String,
        description: "ゲームモードを設定します",
        selection: [
            {title: "サバイバル", value: "survival"},
            {title: "クリエイティブ", value: "creative"},
            {title: "アドベンチャー", value: "adventure"},
            {title: "スペクテイター", value: "spectator"}
        ]
    },
    "generate-structures": {
        value: true,
        type: Boolean,
        description: "村などの構造物を生成するかを設定します"
    },
    "generator-settings": {
        value: "",
        type: String,
        description: "ワールド生成のカスタマイズに使用する設定です\njsonで記述してください"
    },
    "hardcode": {
        value: false,
        type: Boolean,
        description: "ハードコアモードを設定します\nプレイヤーが死んだ場合、スペクテイターになります"
    },
    "level-name": {
        value: "world",
        type: String,
        description: "ワールド名とそのフォルダ名を設定します"
    },
    "level-seed": {
        value: "",
        type: String,
        description: "ワールドのシード値を設定します"
    },
    "level-type": {
        value: "normal",
        type: String,
        description: "ワールドのタイプを設定します"

    },
    "max-build-height": {
        value: 256,
        type: Number,
        description: "ブロックを設置できる最高高度を設定します\n8の倍数で設定してください",
        limit: [0, 256]
    },
    "max-players": {
        value: 20,
        type: Number,
        description: "サーバーに参加できる最大人数を設定します",
        limit: [0, 2**31 - 1]
    },
    "max-tick-time": {
        value: 60000,
        type: Number,
        description: "1ティックの処理にかかる時間がこの値を超えた場合にサーバーを停止します",
        limit: [0, 2**63 - 1]
    },
    "max-world-size": {
        value: 29999984,
        type: Number,
        description: "ワールドの最大サイズの半径を設定します",
        limit: [1, 29999984]
    },
    "motd": {
        value: "A Minecraft Server",
        type: String,
        description: "サーバー一覧のサーバー名の下に表示されるメッセージを設定します"
    },
    "network-compression-threshold": {
        value: 256,
        type: Number,
        description: "データの圧縮を行う最小値を設定します"
    },
    "online-mode": {
        value: true,
        type: Boolean,
        description: "Minecraftアカウントの認証を行うか設定します"
    },
    "op-permission-level": {
        value: 4,
        type: Number,
        description: "OP権限のレベルを設定します",
        limit: [1, 4]
    },
    "player-idle-timeout": {
        value: 0,
        type: Number,
        description: "無操作のプレイヤーをキックするまでの時間を分で設定します\n0にすると無効になります"
    },
    "prevent-proxy-connections": {
        value: false,
        type: Boolean,
        description: "VPNやプロキシの使用を制限します"
    },
    "pvp": {
        value: true,
        type: Boolean,
        description: "プレイヤー同士の攻撃が通るようにします"
    },
    "query.port": {
        value: 25565,
        type: Number,
        description: "クエリサーバーのポート番号を設定します",
        limit: [1, 2**16 - 2]
    },
    "rate-limit": {
        value: 0,
        type: Number,
        description: "プレイヤーがキックされるまでに送信できるパケットの最大量を設定します",
    },
    "rcon.password": {
        value: "",
        type: String,
        description: "RCONのパスワードを設定します"
    },
    "rcon.port": {
        value: 25575,
        type: Number,
        description: "RCONのポート番号を設定します",
        limit: [1, 65534]
    },
    "resource-pack": {
        value: "",
        type: String,
        description: "リソースパックのURLを設定します"
    },
    "resource-pack-sha1": {
        value: "",
        type: String,
        description: "リソースパックのSHA-1 ダイジェストを設定します\nリソースパックが正しいものか検証する際に使用されます"
    },
    "server-ip": {
        value: "",
        type: String,
        description: "サーバーのIPを特定のもののみにしたい場合に設定します\n空欄が推奨されています"
    },
    "server-port": {
        value: 25565,
        type: Number,
        description: "サーバーのポート番号を設定します",
        limit: [1, 65534]
    },
    "snooper-enabled": {
        value: true,
        type: Boolean,
        description: "snoopデータを送信するかを設定します"
    },
    "spawn-animals": {
        value: true,
        type: Boolean,
        description: "動物がスポーンするかどうかを設定します"
    },
    "spawn-monsters": {
        value: true,
        type: Boolean,
        description: "モンスターがスポーンするかどうかを設定します"
    },
    "spawn-npcs": {
        value: true,
        type: Boolean,
        description: "村人がスポーンするかどうかを設定します"
    },
    "spawn-protection": {
        value: 16,
        type: Number,
        description: "スポーン保護の半径を決定します"
    },
    "use-native-transport": {
        value: true,
        type: Boolean,
        description: "Linuxサーバーでパケット送受信の最適化を行います"
    },
    "view-distance": {
        value: 10,
        type: Number,
        description: "サーバーがクライアントに送信するワールドデータの半径を設定します",
        limit: [2, 32]
    },
    "white-list": {
        value: false,
        type: Boolean,
        description: "ホワイトリストを有効にします"
    },
    "enforce-whitelist": {
        value: false,
        type: Boolean,
        description: "ホワイトリストを読み込んだ際に登録されていないプレイヤーをキックします"
    }
}

export default class {
    filePath: string = ""
    props: IProperties = {}

    escapeUnicode(data: string) {
        let result = data.replace(/[^\x00-\x7F]/g, c => "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4))
        result = result.replace("\\", "\\\\")
        result = result.replace("!", "\\!")
        result = result.replace("#", "\\#")
        result = result.replace(":", "\\:")
        result = result.replace("=", "\\=")
        return result
    }

    unescapeUnicode(data: string) {
        let result = data.replace(/\\u([a-fA-F0-9]{4})/g, (x, y) => String.fromCharCode(parseInt(y, 16)))
        result = result.replace("\\\\", "\\")
        result = result.replace("\\!", "!")
        result = result.replace("\\#", "#")
        result = result.replace("\\:", ":")
        result = result.replace("\\=", "=")
        return result
    }

    constructor(filePath: string, window: Window) {
        const rawData = window.file.exists(filePath) ? window.file.load(filePath, "utf-8") : ""

        const lines = rawData.split("\n")
        for (const l of lines) {
            if (l.startsWith("#") || l.replace(/\s/g, "").length === 0) continue
            let [key, value] = l.split(/(?<=^[^=]+?)=/)
            value = this.unescapeUnicode(value)
            let keyMatch = /\s*(.*?)\s*$/.exec(key)
            if (keyMatch) key = keyMatch[1]
            let valueMatch = /\s*(.*?)\s*$/.exec(value)
            if (valueMatch) value = valueMatch[1]

            if (!(key in defaults)) {
                this.props[key] = {
                    value: value,
                    type: String,
                    description: "不明なプロパティです"
                }
            }
            else if (defaults[key].type === Boolean) this.props[key] = {
                value: value.toLowerCase() === "true",
                type: Boolean,
                description: defaults[key].description,
                limit: defaults[key].limit,
                selection: defaults[key].selection
            }
            else this.props[key] = {
                value: defaults[key].type(value),
                type: defaults[key].type,
                description: defaults[key].description,
                limit: defaults[key].limit,
                selection: defaults[key].selection
            }
        }

        for (const [key, value] of Object.entries(defaults)) {
            if (!(key in this.props))
                this.props[key] = {
                    value: value.value,
                    type: value.type,
                    description: value.description,
                    limit: value.limit,
                    selection: value.selection
                }
        }

        this.filePath = filePath
    }

    save(window: Window) {
        const text = Object.entries(this.props)
            .map(([key, value]) => key + "=" + this.escapeUnicode(value.value + ""))
            .join("\n")

        window.file.save(this.filePath, text)
    }
}