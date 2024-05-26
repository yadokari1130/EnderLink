<script lang="ts">
import ServerCard, { ServerData } from "./ServerCard.vue";
import { useGitHubStore } from "../store/github";
import { defineComponent } from "vue";
import {IFile} from "../@types/global";
import { useServerSettingsStore } from "../store/server-settings";
import axios from "axios";
import { compare } from "compare-versions";
import WorldCard from "./WorldCard.vue";

export default defineComponent({
  name: "Home",
  components: {WorldCard, ServerCard},
  computed: {
    ServerData(): ServerData {
      return ServerCard.ServerData
    },
    joinedPath() {
      return window.file.resolve(window.file.join(this.path, this.server?.name ? this.server.name : ""))
    },
    newJoinedPath() {
      return window.file.resolve(window.file.join(this.path, this.name))
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
    args: "",
    jarPath: "",
    serverSettingsStore: useServerSettingsStore(),
    snackbarMessage: "",
    snackbar: false,
    errorSnackbar: false,
    errorMessage: "",
    overlay: false,
    overlayMessage: "",
    minecraftVersions: [],
    selectedVersion: 0,
    eula: false,
    selectedWorldPath: "",
    singleWorldDialog: false,
    singleWorlds: [],
    serverFiles: [],
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
    await this.githubStore.fetchData(window)
    axios.get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .then(res => {
          for (let v of res.data.versions) {
            if (v.type !== "release") continue
            if (compare(v.id, "1.18", "<")) continue
            this.minecraftVersions.push(v)
          }
        })
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
        args: this.args,
        jarPath: window.file.join(this.joinedPath, this.jarPath),
        repositoryId: this.server.id,
        owner: this.server.owner.login
      }
      window.file.save(this.serversPath, JSON.stringify(this.datas))
      this.server = null
      this.path = ""
      this.minMem = 0
      this.maxMem = 0
      this.args = ""
      this.jarPath = ""

      this.dialog = false
      this.overlay = false
    },
    async addServer(create: boolean) {
      this.setOverlay("サーバー追加中")
      if (create) {
        this.path = window.file.join(this.path, this.name)
        try {
          window.file.mkdir(this.path)
        }
        catch (error) {
          console.log(error)
          this.setError("フォルダの作成に失敗しました")
          return
        }
      }
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
        if (create) window.file.save(window.file.join(this.path, "eula.txt"), "eula=true")
      }
      catch (error) {
        console.log(error)
        this.setError("ファイル作成に失敗しました")
        this.overlay = false
        return
      }

      try {
        if (this.selectedWorldPath) window.file.cp(this.selectedWorldPath, window.file.join(this.path, "world"), () => true)
      }
      catch (error) {
        console.log(error)
        this.setError("ワールドのコピーに失敗しました")
        return
      }

      if (create && !(await this.downloadServer())) return

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
        args: this.args,
        repositoryId: repositoryId,
        owner: owner
      }
      window.file.save(this.serversPath, JSON.stringify(this.datas))
      this.name = ""
      this.path = ""
      this.minMem = 0
      this.maxMem = 0
      this.args = ""
      this.jarPath = ""
      this.eula = false
      this.selectedWorldPath = null

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
    },
    async downloadServer() {
      try {
        let res = await axios.get(this.minecraftVersions[this.selectedVersion].url, {responseType: "arraybuffer"})
        let byteHash = await window.crypto.subtle.digest("SHA-1", res.data)
        let arrayHash = Array.from(new Uint8Array(byteHash));
        let hash = arrayHash
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")

        if (hash !== this.minecraftVersions[this.selectedVersion].sha1) {
          this.setError("不正なファイルを検出したため、ダウンロードをキャンセルしました")
          return false
        }

        const data = JSON.parse(new TextDecoder().decode(res.data))

        res = await axios.get(data.downloads.server.url, {responseType: "arraybuffer"})
        byteHash = await window.crypto.subtle.digest("SHA-1", res.data)
        arrayHash = Array.from(new Uint8Array(byteHash));
        hash = arrayHash
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")

        if (hash !== data.downloads.server.sha1) {
          this.setError("不正なファイルを検出したため、ダウンロードをキャンセルしました")
          return false
        }

        try {
          window.file.saveBin(window.file.join(this.path, "server.jar"), res.data)
        }
        catch (error) {
          console.log(error)
          this.setError("ファイルの保存に失敗しました")
          return false
        }
      }
      catch (error) {
        this.setError("ファイルのダウンロードに失敗しました")
        return false
      }

      return true
    },
    openExternal(url: string) {
      window.shell.openExternal(url)
    },
    async selectSingleWorld() {
      this.selectedWorldPath = null
      let savesPath = window.file.getMinecraftPath("saves")
      let singleFiles = window.file.getAllChildren(savesPath)
      this.singleWorlds = singleFiles.map(s => window.file.join(savesPath, s))

      this.singleWorldDialog = true
    },
    async selectFile() {
      this.selectedWorldPath = null
      let selected = await window.file.selectPath()
      if (selected) {
        if (!window.file.exists(window.file.join(selected[0], "level.dat"))) {
          this.setError("ワールドフォルダではありません")
          return
        }
        this.selectedWorldPath = selected[0]
      }
    },
    async selectJar() {
      if (!this.path) return

      let selected = await window.file.selectFilePath(this.path)
      if (!selected) return
      let dirname = window.file.dirname(selected[0])
      if (dirname !== this.path) {
        this.setError("サーバーフォルダ内にあるjarファイルを選択してください")
        return
      }
      if (!selected[0].endsWith(".jar")) {
        this.setError("jarファイルを選択してください")
        return
      }

      this.jarPath = selected[0]
    }
  },
  watch: {
    async tab(newValue, oldValue) {
      this.name = ""
      this.args = ""
      this.jarPath = ""
      this.maxMem = 2048
      this.minMem = 0
      this.eula = false
      this.selectedWorldPath = null
      this.server = null

      if (newValue === 3) await this.fetchAllRepository()
    },
    async server(newValue, oldValue) {
      this.serverFiles = []
      if (!newValue) return

      try {
        this.serverFiles = (await this.githubStore.octokit.repos.getContent({
          owner: newValue.owner.login,
          repo: newValue.name,
          path: ""
        })).data.map(f => f.name)
      }
      catch (error) {
        console.log(error)
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
    <v-col cols="12">
      <p>サーバーがありません</p>
      <p>右下の「<v-icon>mdi-plus</v-icon>」ボタンからサーバーを追加してください</p>
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

  <v-tooltip
      location="left"
      :disabled="githubStore.userData && githubStore.availableSSH && !!githubStore.gitVersion"
  >
    <template v-slot:activator="{ props }">
      <div
          class="d-inline-block"
          v-bind="props"
          style="bottom: 30px; right: 50px; position: fixed"
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
              this.args = ''
              this.jarPath = ''
              this.eula = false
              this.selectedWorldPath = null
            }"
            :disabled="!githubStore.userData || !githubStore.availableSSH || !githubStore.gitVersion"
        />
      </div>
    </template>
    <p>サーバーを追加するためには基本設定画面から</p>
    <p>Gitのインストール、GitHubにログイン、SSHキーの追加を行ってください</p>
  </v-tooltip>

  <v-dialog
      v-model="dialog"
      width="1000px"
      transition="slide-y-transition"
  >
    <v-card title="サーバーを追加">
      <v-tabs
          v-model="tab"
          align-tabs="center"
          color="primary"
      >
        <v-row justify="space-evenly">
          <v-col cols="4"><v-tab :value="1" width="100%">新規作成</v-tab></v-col>
          <v-col cols="4"><v-tab :value="2" width="100%">PCからインポート</v-tab></v-col>
          <v-col cols="4"><v-tab :value="3" width="100%">GitHubからインポート</v-tab></v-col>
        </v-row>
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
              <v-col cols="12">
                <v-select
                    :items="minecraftVersions.map((v, i) => ({title: v.id, value: i}))"
                    variant="outlined"
                    label="バージョンを選択"
                    hide-details
                    v-model="selectedVersion"
                />
              </v-col>
              <v-col cols="6">
                <v-btn
                    color="primary"
                    size="large"
                    width="100%"
                    @click="selectSingleWorld"
                >シングルワールドを選択</v-btn>
              </v-col>
              <v-col cols="6">
                <v-tooltip location="bottom">
                  <template v-slot:activator="{props}">
                    <v-btn
                        color="primary"
                        size="large"
                        width="100%"
                        @click="selectFile"
                        v-bind="props"
                    >ワールドフォルダを選択</v-btn>
                  </template>
                  配布ワールドなどは解凍したものを選択してください
                </v-tooltip>
              </v-col>
              <v-col cols="12" v-if="selectedWorldPath">
                <div class="d-flex flex-row align-center">
                  <world-card
                      :path="selectedWorldPath"
                      width="100%"/>
                  <v-btn
                      color="red"
                      variant="text"
                      icon="mdi-close"
                      size="x-large"
                      class="ma-2"
                      @click="selectedWorldPath = null"
                  ></v-btn>
                </div>
              </v-col>
              <v-col cols="12" v-else>
                <h3 class="text-center">ワールド指定なし(ワールドを新規生成)</h3>
              </v-col>
              <v-col cols="3">
                <v-btn
                    size="large"
                    @click="selectPath"
                    color="primary"
                    width="100%"
                >保存先のフォルダを選択</v-btn>
              </v-col>
              <v-col cols="9" align-self="center">
                <p class="text-end">{{newJoinedPath}}</p>
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
              <v-col cols="12">
                <v-text-field
                    variant="outlined"
                    label="Javaオプション"
                    v-model="args"
                    hide-details
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-checkbox v-model="eula">
                  <template v-slot:prepend>
                    利用規約(
                    <div class="d-flex flex-row align-center" style="cursor: pointer;" @click="openExternal('https://aka.ms/MinecraftEULA')">
                      <div class="text-blue text-decoration-underline">https://aka.ms/MinecraftEULA</div>
                      <v-icon>mdi-open-in-new</v-icon>
                    </div>
                    )に同意
                  </template>
                </v-checkbox>
              </v-col>
            </v-row>
          </v-window-item>
          <v-window-item :value="2">
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
                <v-btn
                    size="large"
                    @click="selectPath"
                    color="primary"
                    width="100%"
                >サーバーフォルダを選択</v-btn>
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
              <v-col cols="10">
                <p>{{jarPath}}</p>
              </v-col>
              <v-col cols="2">
                <v-btn
                    width="100%"
                    color="primary"
                    size="large"
                    @click="selectJar"
                    :disabled="!path"
                >jarを選択</v-btn>
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-text-field
                    variant="outlined"
                    label="Javaオプション"
                    v-model="args"
                    hide-details
                />
              </v-col>
            </v-row>
          </v-window-item>
          <v-window-item :value="3">
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
                <v-btn
                    size="large"
                    @click="selectPath"
                    color="primary"
                    width="100%"
                >保存先のフォルダを選択</v-btn>
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
              <v-col cols="12">
                <v-select
                    label="jarを選択"
                    variant="outlined"
                    :items="serverFiles.filter(f => f.endsWith('.jar'))"
                    hide-details
                    v-model="jarPath"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field
                    variant="outlined"
                    label="Javaオプション"
                    v-model="args"
                    hide-details
                />
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
              if (tab === 1) addServer(true)
              else if (tab === 2) addServer(false)
              else if (tab === 3) cloneServer()
            }"
            size="large"
            :disabled="!(
                (tab === 1 && this.githubValidation(this.name) === true && this.eula) ||
                (tab === 2 && this.githubValidation(this.name) === true && this.jarPath) ||
                (tab === 3 && this.server && this.jarPath))"
        >追加</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-overlay
      :model-value="overlay"
      class="align-center justify-center"
      persistent
      opacity="0.7"
  >
    <v-progress-circular
        width="8"
        color="blue-lighten-2"
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

  <v-dialog
      v-model="singleWorldDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="シングルワールドを選択">
      <v-card-text>
        <v-row justify="center">
          <world-card
              class="my-4"
              v-for="s in singleWorlds"
              :path="s"
              hover
              width="600px"
              @click="() => {
                this.selectedWorldPath = s
                this.singleWorldDialog = false
              }"/>
        </v-row>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="singleWorldDialog = false"
            size="large"
        >閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
