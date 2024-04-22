<script lang="ts">
import { defineComponent } from 'vue'
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
    serverProps: ServerProperties | null
  },
  emits: ["setError", "setOverlay", "setSnackbar", "setCommitLog"],
  data: () => ({
    whitelists: [],
    serverSettingsStore: useServerSettingsStore(),
    deletePlayers: [],
    addPlayers: [],
    playerName: "",
    adding: false,
    runningStore: useRunningStore()
  }),
  async mounted() {
    let wl = JSON.parse(window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "whitelist.json"), "utf-8"))
    this.whitelists = await Promise.all(wl.map(async (p: {name: string, uuid: string}) => await Player.build({name: p.name, uuid: p.uuid}, window)))
  },
  methods: {
    async addPlayer() {
      this.adding = true
      let uuid = await Player.getUuid(this.playerName, window)
      if (!uuid) {
        this.$emit("setError", "指定されたプレイヤーが見つかりませんでした")
        this.adding = false
        return
      }

      let player = await Player.build({name: this.playerName, uuid: uuid}, window)
      if (!this.addPlayers.includes(player)) this.addPlayers.push(player)
      this.adding = false
    },
    async save() {
      this.$emit("setOverlay", "保存中")

      let wlJson = []
      this.whitelists.forEach((p: Player) => {
        if (!this.deletePlayers.includes(p.name)) wlJson.push({name: p.name, uuid: p.uuid})
      })
      this.addPlayers.forEach((p: Player) => {
        if (!this.deletePlayers.includes(p.name)) wlJson.push({name: p.name, uuid: p.uuid})
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
</template>

<style scoped>

</style>