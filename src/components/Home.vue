<script lang="ts">
import ServerCard, { ServerData } from "./ServerCard.vue";
import { useGitHubStore } from "../store/github";
import { defineComponent } from "vue";
import {IFile} from "../@types/global";
import { useServerSettingsStore } from "../store/server-settings";

export default defineComponent({
  name: "Home",
  components: {ServerCard},
  computed: {
    ServerData(): ServerData {
      return ServerCard.ServerData
    },
    joinedPath() {
      return window.file.resolve(window.file.join(this.path, this.server?.name ? this.server.name : ""))
    }
  },
  data: () => ({
    datas: {},
    dialog: false,
    path: "",
    name: "",
    maxMem: 2048,
    minMem: 0,
    serversPath: "",
    githubStore: useGitHubStore(),
    tab: 1,
    repositories: [],
    githubValidation: (value: string) => (value.match(/[\w\-]{2,255}/g) && value.match(/[\w\-]{2,255}/g)[0] === value) || "名前は2文字以上255文字以下かつ、半角英数字・アンダーバー・ハイフンのみが使えます",
    server: null,
    command: "",
    serverSettingsStore: useServerSettingsStore(),
    snackbarMessage: "",
    snackbar: false,
    errorSnackbar: false,
    errorMessage: "",
    overlay: false,
    overlayMessage: ""
  }),
  async mounted() {
    this.serversPath = await window.file.getUserDataPath("servers.json")
    if (window.file.exists(this.serversPath)) this.datas = JSON.parse(window.file.load(this.serversPath, "utf-8"))
    if (this.githubStore.octokit) await this.fetchAllRepository()
    if (this.serverSettingsStore.deleted) {
      this.serverSettingsStore.deleted = false
      this.snackbarMessage = "サーバーを削除しました"
      this.snackbar = true
    }
  },
  async created() {
    await this.githubStore.fetchData()
  },
  methods: {
    setSnackbar(message: string) {
      this.snackbar = true
      this.snackbarMessage = message
      this.overlay = false
    },
    setOverlay(message: string) {
      this.overlay = true
      this.overlayMessage = message
    },
    setError(message: string) {
      this.errorSnackbar = true
      this.errorMessage = message
      this.overlay = false
    },
    async cloneServer() {
      if (window.file.exists(this.joinedPath)) {
        this.setError("すでにそのフォルダが存在します\n別のフォルダを指定してください")
        return
      }

      this.setOverlay("サーバー追加中")
      try {
        await window.git.clone(this.path, this.joinedPath, this.server.ssh_url, this.githubStore.userData.email, this.githubStore.userData.login)
      }
      catch (error) {
        console.log(error)
        this.setError("クローンに失敗しました")
        this.overlay = false
        return
      }

      this.datas[this.server.id] = {
        name: this.server.name,
        path: this.joinedPath,
        url: this.server.html_url,
        maxMem: this.maxMem,
        minMem: this.minMem,
        command: this.command,
        repositoryId: this.server.id,
        owner: this.server.owner.login
      }
      window.file.save(this.serversPath, JSON.stringify(this.datas))
      this.server = null
      this.path = ""
      this.minMem = 0
      this.maxMem = 0
      this.command = ""

      this.dialog = false
      this.overlay = false
    },
    async addServer() {
      this.setOverlay("サーバー追加中")
      try {
        await this.githubStore.octokit.repos.get({
          owner: (await this.githubStore.octokit.rest.users.getAuthenticated()).data.login,
          repo: this.name
        })

        this.setError("その名前はすでに存在します")
        this.overlay = false
        return
      }
      catch (error) {
        if (error.status !== 404) {
          console.log(error)
          this.setError(null)
          this.overlay = false
          return
        }
      }

      let url = null
      let htmlUrl = null
      let repositoryId = null
      let owner = null
      try {
        const res = (await this.githubStore.octokit.repos.createForAuthenticatedUser({name: this.name, private: true})).data
        url = res.ssh_url
        htmlUrl = res.html_url
        repositoryId = res.id
        owner = res.owner.login
      }
      catch (error) {
        console.log(error)
        this.setError("作成に失敗しました")
        this.overlay = false
        return
      }

      if (!url) {
        this.setError("URL not returned")
        this.overlay = false
        return
      }

      try {
        window.file.save(window.file.join(this.path, "status.txt"), "#stopping")
      }
      catch (error) {
        console.log(error)
        this.setError("ファイル作成に失敗しました")
        this.overlay = false
        return
      }

      try {
        if (!window.file.exists(window.file.join(this.path, ".git"))) {
          await window.git.init(this.path, this.githubStore.userData.email, this.githubStore.userData.login, url)
        }
        await window.git.upload(this.path, "サーバー作成")
      }
      catch (error) {
        console.log(error)
        this.setError("pushに失敗しました")
        this.overlay = false
        return
      }

      this.datas[repositoryId] = {
        name: this.name,
        path: this.path,
        url: htmlUrl,
        maxMem: this.maxMem,
        minMem: this.minMem,
        command: this.command,
        repositoryId: repositoryId,
        owner: owner
      }
      window.file.save(this.serversPath, JSON.stringify(this.datas))
      this.name = ""
      this.path = ""
      this.minMem = 0
      this.maxMem = 0
      this.command = ""

      this.dialog = false
      this.overlay = false
    },
    async selectPath() {
      const result = await window.file.selectPath()
      if (result !== undefined) this.path = result[0]
    },
    async fetchAllRepository() {
      this.repositories = []
      let p = 1
      while (true) {
        const repo = (await this.githubStore.octokit.repos.listForAuthenticatedUser({per_page: 100, page: p++})).data
        if (repo.length === 0) break
        repo.forEach(r => this.repositories.push(r))
      }
    }
  }
})
</script>
<template>
  <v-row>
    <v-col>
      <h1>サーバー一覧</h1>
    </v-col>
  </v-row>
  <v-row v-if="Object.keys(datas).length === 0">
    <v-col>
      <p>サーバーがありません</p>
      <p>右下の「+」ボタンからサーバーを追加してください</p>
    </v-col>
  </v-row>

  <v-row justify="space-evenly">
    <server-card
        :serverData="d as ServerData"
        v-for="d in Object.values(datas)"
        class="my-6"
        @set-error="m => setError(m)"
        @set-overlay="m => setOverlay(m)"
    />
    <div style="width: 600px" v-if="Object.keys(datas).length % 2 === 1" class="my-6"/>
  </v-row>

  <v-layout-item model-value position="bottom" class="text-end" size="120">
    <div class="ma-4 mx-12">
      <v-tooltip
          location="top"
          :disabled="githubStore.userData && githubStore.existsSSHKey"
      >
        <template v-slot:activator="{ props }">
          <v-btn
              icon
              v-bind="props"
          >
            <v-btn
                icon="mdi-plus"
                size="x-large"
                color="primary"
                elevation="8"
                @click="() => {
                  this.dialog = true
                  this.path = ''
                  this.name = ''
                  this.server = null
                  this.command = ''
                }"
                :disabled="!githubStore.userData || !githubStore.existsSSHKey"
            />
          </v-btn>
        </template>
        <p>サーバーを追加するためには基本設定画面から</p>
        <p>GitHubにログインし、SSHキーを追加してください</p>
      </v-tooltip>
    </div>
  </v-layout-item>

  <v-dialog
      v-model="dialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="サーバーを追加">
      <v-tabs
          v-model="tab"
          align-tabs="center"
          color="deep-purple-accent-4"
      >
        <v-tab :value="1">フォルダを追加</v-tab>
        <v-tab :value="2">GitHubからインポート</v-tab>
      </v-tabs>
      <v-card-text>
        <v-window v-model="tab">
          <v-window-item :value="1">
            <v-row class="mt-2">
              <v-col cols="12">
                <v-text-field
                    label="サーバー名"
                    variant="outlined"
                    v-model="name"
                    :rules="[githubValidation]"
                />
              </v-col>
              <v-col cols="3">
                <v-btn size="large" @click="selectPath">フォルダを選択</v-btn>
              </v-col>
              <v-col cols="9" align-self="center">
                <p class="text-end">{{path}}</p>
              </v-col>
              <v-col cols="6">
                <v-text-field
                    type="number"
                    label="最大メモリ"
                    suffix="MB"
                    v-model.number="maxMem"
                    variant="outlined"
                    @change="maxMem = Math.max(minMem + 1, maxMem)"
                    hide-details
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                    type="number"
                    label="最小メモリ"
                    suffix="MB"
                    v-model.number="minMem"
                    variant="outlined"
                    @change="() => {minMem = Math.max(0, minMem); maxMem = Math.max(minMem, maxMem)}"
                    hide-details
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-text-field
                    variant="outlined"
                    label="起動コマンド"
                    v-model="command"
                    placeholder="例：java -jar server.jar nogui"/>
              </v-col>
            </v-row>
          </v-window-item>
          <v-window-item :value="2">
            <v-row class="mt-2">
              <v-col cols="12">
                <v-select
                    label="サーバー"
                    variant="outlined"
                    v-model="server"
                    :items="repositories.map(r => ({title: r.full_name, value: r}))"
                />
              </v-col>
              <v-col cols="3">
                <v-btn size="large" @click="selectPath">フォルダを選択</v-btn>
              </v-col>
              <v-col cols="9" align-self="center">
                <p class="text-end">{{joinedPath}}</p>
              </v-col>
              <v-col cols="6">
                <v-text-field
                    type="number"
                    label="最大メモリ"
                    suffix="MB"
                    v-model.number="maxMem"
                    variant="outlined"
                    @change="maxMem = Math.max(minMem + 1, maxMem)"
                    hide-details
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                    type="number"
                    label="最小メモリ"
                    suffix="MB"
                    v-model.number="minMem"
                    variant="outlined"
                    @change="() => {minMem = Math.max(0, minMem); maxMem = Math.max(minMem, maxMem)}"
                    hide-details
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-text-field variant="outlined" label="起動コマンド" v-model="command" placeholder="例：java -jar server.jar"></v-text-field>
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="() => {dialog = false}"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="() => {
              if (tab === 1) addServer()
              else if (tab === 2) cloneServer()
            }"
            size="large"
            :disabled="!((tab === 1 && this.githubValidation(this.name) === true) || (tab === 2 && this.server))"
        >追加</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-overlay
      :model-value="overlay"
      class="align-center justify-center"
      persistent
  >
    <v-progress-circular
        color="primary"
        size="200"
        indeterminate
    >
      <template v-slot:default>{{ overlayMessage }}</template>
    </v-progress-circular>
  </v-overlay>

  <v-snackbar
      v-model="snackbar"
      timeout="4000"
      multi-line
  >
    <div style="white-space: pre-wrap;" v-text="snackbarMessage"/>
    <template v-slot:actions>
      <v-btn
          variant="text"
          @click="snackbar = false"
      >
        閉じる
      </v-btn>
    </template>
  </v-snackbar>

  <v-snackbar
      v-model="errorSnackbar"
      timeout="4000"
      multi-line
      color="error"
  >
    <div style="white-space: pre-wrap;" v-text="errorMessage"/>
    <template v-slot:actions>
      <v-btn
          variant="text"
          @click="errorSnackbar = false"
      >
        閉じる
      </v-btn>
    </template>
  </v-snackbar>
</template>
