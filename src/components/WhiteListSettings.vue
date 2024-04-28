<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { useServerSettingsStore } from "../store/server-settings";
import { Player } from "../datas/player";
import running from "./Running.vue";
import { useRunningStore } from "../store/running";
import ServerProperties from "../datas/serverProperties";

export default defineComponent({
  name: "WhiteListSettings",
  computed: {
    running() {
      return running
    }
  },
  props: {
    serverProps: Object as PropType<ServerProperties | null>
  },
  emits: ["setError", "setOverlay", "setSnackbar", "setCommitLog"],
  data: () => ({
    whitelists: [],
    ops: [],
    serverSettingsStore: useServerSettingsStore(),
    deletePlayers: [],
    deleteOPPlayers: [],
    addPlayers: [],
    addOPPlayers: [],
    playerName: "",
    opPlayerName: "",
    opLevel: {},
    bypassesPlayerLimit: {},
    adding: false,
    opAdding: false,
    runningStore: useRunningStore()
  }),
  async mounted() {
    if (window.file.exists(window.file.join(this.serverSettingsStore.serverData.path, "whitelist.json"))) {
      let wl = JSON.parse(window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "whitelist.json"), "utf-8"))
      this.whitelists = await Promise.all(wl.map(async (p: {name: string, uuid: string}) => await Player.build({name: p.name, uuid: p.uuid}, window)))
    }
    if (window.file.exists(window.file.join(this.serverSettingsStore.serverData.path, "ops.json"))) {
      let op = JSON.parse(window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "ops.json"), "utf-8"))
      this.ops = await Promise.all(op.map(async (p: {name: string, uuid: string}) => await Player.build({name: p.name, uuid: p.uuid}, window)))
      op.forEach((p: {name: string, level: number, bypassesPlayerLimit: boolean}) => {
        this.opLevel[p.name] = p.level
        this.bypassesPlayerLimit[p.name] = p.bypassesPlayerLimit
      })
    }
  },
  methods: {
    async addPlayer() {
      if (this.addPlayers.some((p: Player) => p.name === this.playerName) || this.whitelists.some((p: Player) => p.name === this.playerName)) {
        this.playerName = ""
        return
      }
      this.adding = true
      let uuid = await Player.getUuid(this.playerName, window)
      if (!uuid) {
        this.$emit("setError", "指定されたプレイヤーが見つかりませんでした")
        this.adding = false
        return
      }

      let player = await Player.build({name: this.playerName, uuid: uuid}, window)
      this.addPlayers.push(player)

      this.playerName = ""
      this.adding = false
    },
    async addOPPlayer() {
      if (this.addOPPlayers.some((p: Player) => p.name === this.opPlayerName) || this.ops.some((p: Player) => p.name === this.opPlayerName)) {
        this.opPlayerName = ""
        return
      }
      this.opAdding = true
      let uuid = await Player.getUuid(this.opPlayerName, window)
      if (!uuid) {
        this.$emit("setError", "指定されたプレイヤーが見つかりませんでした")
        this.opAdding = false
        return
      }

      let player = await Player.build({name: this.opPlayerName, uuid: uuid}, window)
      this.addOPPlayers.push(player)
      this.opLevel[this.opPlayerName] = 4
      this.bypassesPlayerLimit[this.opPlayerName] = false

      this.opPlayerName = ""
      this.opAdding = false
    },
    async save() {
      this.$emit("setOverlay", "保存中")

      let wlJson = []
      this.whitelists.forEach((p: Player) => {
        if (!this.deletePlayers.includes(p)) wlJson.push({name: p.name, uuid: p.uuid})
      })
      this.addPlayers.forEach((p: Player) => {
        if (!this.deletePlayers.includes(p)) wlJson.push({name: p.name, uuid: p.uuid})
      })

      try {
        window.file.save(window.file.join(this.serverSettingsStore.serverData.path, "whitelist.json"), JSON.stringify(wlJson))
      }
      catch (error) {
        console.error(error)
        this.$emit("setError", "ファイルの保存に失敗しました")
        return
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "ホワイトリストの更新")
      }
      catch (error) {
        console.error(error)
        this.$emit("setError", "データの更新に失敗しました")
        return
      }

      this.addPlayers = []
      this.deletePlayers = []
      let wl = JSON.parse(window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "whitelist.json"), "utf-8"))
      this.whitelists = await Promise.all(wl.map(async (p: {name: string, uuid: string}) => await Player.build({name: p.name, uuid: p.uuid}, window)))

      this.$emit("setSnackbar", "ホワイトリストを更新しました")
    },
    async saveOP() {
      this.$emit("setOverlay", "保存中")

      let opJson = []
      this.ops.forEach((p: Player) => {
        if (!this.deleteOPPlayers.includes(p)) opJson.push({name: p.name, uuid: p.uuid, level: this.opLevel[p.name], bypassesPlayerLimit: this.bypassesPlayerLimit[p.name]})
      })
      this.addOPPlayers.forEach((p: Player) => {
        if (!this.deleteOPPlayers.includes(p)) opJson.push({name: p.name, uuid: p.uuid, level: this.opLevel[p.name], bypassesPlayerLimit: this.bypassesPlayerLimit[p.name]})
      })

      try {
        window.file.save(window.file.join(this.serverSettingsStore.serverData.path, "ops.json"), JSON.stringify(opJson))
      }
      catch (error) {
        console.error(error)
        this.$emit("setError", "ファイルの保存に失敗しました")
        return
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "OP権限の更新")
      }
      catch (error) {
        console.error(error)
        this.$emit("setError", "データの更新に失敗しました")
        return
      }

      this.addOPPlayers = []
      this.deleteOPPlayers = []
      let op = JSON.parse(window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "ops.json"), "utf-8"))
      this.ops = await Promise.all(op.map(async (p: {name: string, uuid: string}) => await Player.build({name: p.name, uuid: p.uuid}, window)))
      op.forEach((p: {name: string, level: number, bypassesPlayerLimit: boolean}) => {
        this.opLevel[p.name] = p.level
        this.bypassesPlayerLimit[p.name] = p.bypassesPlayerLimit
      })

      this.$emit("setSnackbar", "OP権限を更新しました")
    },
    openExternal(url: string) {
      window.shell.openExternal(url)
    }
  }
})
</script>

<template>
  <v-alert
      variant="tonal"
      type="error"
      v-if="!serverProps.props['white-list'].value"
  >
    <p>ホワイトリストが有効になっていません</p>
    <p>プロパティ欄からホワイトリストを有効にしてください</p>
  </v-alert>
  <h2 class="ma-4">ホワイトリスト一覧</h2>
  <div class="rounded border pa-4">
    <v-row class="mt-4 mb-12">
      <v-col cols="10">
        <v-text-field
            variant="outlined"
            label="プレイヤー名"
            hide-details
            v-model="playerName"
            :disabled="adding"
            @keydown.enter="addPlayer"
        />
      </v-col>
      <v-col cols="2">
        <v-btn
            size="large"
            color="primary"
            @click="addPlayer"
            width="100%"
            height="100%"
            :disabled="adding"
        >
          追加
        </v-btn>
      </v-col>

      <v-col cols="12">
        <v-tooltip :disabled="!runningStore.isRunning" location="bottom">
          <template v-slot:activator="{props}">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  size="large"
                  color="primary"
                  @click="save"
                  width="100%"
                  :disabled="(addPlayers.length === 0 && deletePlayers.length === 0) || runningStore.isRunning"
              >
                保存
              </v-btn>
            </div>
          </template>
          <p>起動中のサーバーを停止してください</p>
        </v-tooltip>
      </v-col>
    </v-row>

    <h2 class="mb-4 text-center" v-if="addPlayers.length === 0 && whitelists.length === 0">プレイヤーなし</h2>

    <v-card
        v-for="p in whitelists"
        variant="outlined"
        :color="deletePlayers.includes(p) ? 'red' : 'black'"
        class="mt-6"
    >
      <v-card-title>
        <div class="d-flex flex-row align-center">
          <v-img rounded inline width="64px" :src="p.avatarUrl"/>
          <h3 class="ml-4">{{p.name}}</h3>
          <v-spacer/>
          <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="x-large"
              @click="deletePlayers.push(p)"
              v-if="!deletePlayers.includes(p)"
          />
          <v-btn
              icon="mdi-arrow-u-left-top"
              variant="text"
              size="x-large"
              @click="deletePlayers = deletePlayers.filter(o => o !== p)"
              v-if="deletePlayers.includes(p)"
          />
        </div>
      </v-card-title>
    </v-card>
    <v-card
        v-for="p in addPlayers"
        variant="outlined"
        :color="deletePlayers.includes(p) ? 'red' : 'blue'"
        class="mt-6"
    >
      <v-card-title>
        <div class="d-flex flex-row align-center">
          <v-img rounded inline width="64px" :src="p.avatarUrl"/>
          <h3 class="ml-4">{{p.name}}</h3>
          <v-spacer/>
          <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="x-large"
              @click="deletePlayers.push(p)"
              v-if="!deletePlayers.includes(p)"
          />
          <v-btn
              icon="mdi-arrow-u-left-top"
              variant="text"
              size="x-large"
              @click="deletePlayers = deletePlayers.filter(o => o !== p)"
              v-if="deletePlayers.includes(p)"
          />
        </div>
      </v-card-title>
    </v-card>
  </div>

  <h2 class="ma-4 mt-16">OP権限一覧</h2>
  <div class="rounded border pa-4">
    <v-row class="mt-4 mb-12">
      <v-col cols="10">
        <v-text-field
            variant="outlined"
            label="プレイヤー名"
            hide-details
            v-model="opPlayerName"
            :disabled="opAdding"
            @keydown.enter="addOPPlayer"
        />
      </v-col>
      <v-col cols="2">
        <v-btn
            size="large"
            color="primary"
            @click="addOPPlayer"
            width="100%"
            height="100%"
            :disabled="opAdding"
        >
          追加
        </v-btn>
      </v-col>

      <v-col cols="12">
        <v-tooltip :disabled="!runningStore.isRunning" location="bottom">
          <template v-slot:activator="{props}">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  size="large"
                  color="primary"
                  @click="saveOP"
                  width="100%"
                  :disabled="(addOPPlayers.length === 0 && deleteOPPlayers.length === 0) || runningStore.isRunning"
              >
                保存
              </v-btn>
            </div>
          </template>
          <p>起動中のサーバーを停止してください</p>
        </v-tooltip>
      </v-col>
    </v-row>

    <h2 class="mb-4 text-center" v-if="addOPPlayers.length === 0 && ops.length === 0">プレイヤーなし</h2>

    <p class="text-end text-blue text-decoration-underline" style="cursor: pointer" @click="openExternal('https://minecraft.fandom.com/ja/wiki/%E6%A8%A9%E9%99%90%E3%83%AC%E3%83%99%E3%83%AB#%E5%8A%B9%E6%9E%9C')">
      権限レベルとは？
      <v-icon>mdi-open-in-new</v-icon>
    </p>
    <v-card
        v-for="p in ops"
        variant="outlined"
        :color="deleteOPPlayers.includes(p) ? 'red' : 'black'"
        class="mt-6"
    >
      <v-card-title>
        <div class="d-flex flex-row align-center">
          <v-img rounded inline width="64px" :src="p.avatarUrl"/>
          <h3 class="ml-4">{{p.name}}</h3>
          <v-spacer/>
          <v-select
              label="権限レベル"
              :items="[1, 2, 3, 4]"
              v-model="opLevel[p.name]"
              variant="outlined"
              hide-details
              style="max-width: 200px"
          />
          <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="x-large"
              @click="deleteOPPlayers.push(p)"
              v-if="!deleteOPPlayers.includes(p)"
          />
          <v-btn
              icon="mdi-arrow-u-left-top"
              variant="text"
              size="x-large"
              @click="deleteOPPlayers = deleteOPPlayers.filter(o => o !== p)"
              v-if="deleteOPPlayers.includes(p)"
          />
        </div>
      </v-card-title>
    </v-card>
    <v-card
        v-for="p in addOPPlayers"
        variant="outlined"
        :color="deleteOPPlayers.includes(p) ? 'red' : 'blue'"
        class="mt-6"
    >
      <v-card-title>
        <div class="d-flex flex-row align-center">
          <v-img rounded inline width="64px" :src="p.avatarUrl"/>
          <h3 class="ml-4">{{p.name}}</h3>
          <v-spacer/>
          <v-select
              label="権限レベル"
              :items="[1, 2, 3, 4]"
              v-model="opLevel[p.name]"
              variant="outlined"
              hide-details
              style="max-width: 200px"
          />
          <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="x-large"
              @click="deleteOPPlayers.push(p)"
              v-if="!deleteOPPlayers.includes(p)"
          />
          <v-btn
              icon="mdi-arrow-u-left-top"
              variant="text"
              size="x-large"
              @click="deleteOPPlayers = deleteOPPlayers.filter(o => o !== p)"
              v-if="deleteOPPlayers.includes(p)"
          />
        </div>
      </v-card-title>
    </v-card>
  </div>
</template>

<style scoped>

</style>