<script lang="ts">
import { defineComponent } from 'vue'
import { useServerSettingsStore } from "../store/server-settings";
import {IFile} from "../@types/global";
import { useGitHubStore } from "../store/github";
import { useRouter } from "vue-router";
import { useRunningStore } from "../store/running";
import ServerProperties from "./ServerProperties.vue";
import WorldSettings from "./WorldSettings.vue";

export default defineComponent({
  name: "ServerSettings",
  components: {WorldSettings, ServerProperties},
  data: () => ({
    serverSettingsStore: useServerSettingsStore(),
    githubStore: useGitHubStore(),
    runningStore: useRunningStore(),
    icon: null,
    minMem: 0,
    maxMem: 0,
    command: "",
    datas: {},
    serversPath: "",
    snackbar: false,
    snackbarMessage: "",
    directoryDialog: false,
    repositoryDialog: false,
    errorSnackbar: false,
    errorMessage: "",
    router: useRouter(),
    commitLog: [],
    rollbackDialog: false,
    commit: null,
    overlay: false,
    overlayMessage: "",
    forceUploadDialog: false,
    forceDownloadDialog: false,
    collaborators: [],
    found: true,
    userName: "",
    jpStatus: {"joined": "参加済", "inviting": "招待中"},
    collaborator: null,
    deleteCollaboratorDialog: false,
    deletedCollaborator: [],
    status: "",
    tab: 1
  }),
  async mounted() {
    this.serversPath = await window.file.getUserDataPath("servers.json")
    if (window.file.exists(this.serversPath)) this.datas = JSON.parse(window.file.load(this.serversPath, "utf-8"))
    if (window.file.exists(window.file.join(this.serverSettingsStore.serverData.path, "server-icon.png")))
      this.icon = window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "server-icon.png"), "base64")
    this.minMem = this.serverSettingsStore.serverData.minMem
    this.maxMem = this.serverSettingsStore.serverData.maxMem
    this.command = this.serverSettingsStore.serverData.command
    this.setCommitLog()
        .catch(error => console.log(error))
    this.setCollaborators()
        .catch(error => console.log(error))
    this.setStatus()
  },
  methods: {
    setStatus() {
      this.status = window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "status.txt"), "utf-8").replace("\n", "")
    },
    async setCommitLog() {
      this.commitLog = (await window.git.log(this.serverSettingsStore.serverData.path)).all.map(c => ({
        author: c.author_name,
        time: new Date(c.date).toLocaleString("ja-JP"),
        message: c.message,
        hash: c.hash
      }))
    },
    async setCollaborators() {
      this.collaborators = (await this.githubStore.octokit.repos.listCollaborators({
        repo: this.serverSettingsStore.serverData.name,
        owner: this.serverSettingsStore.serverData.owner
      })).data.map(u => ({name: u.login, avatarUrl: u.avatar_url, status: "joined"}))
      this.collaborators.push(...(await this.githubStore.octokit.repos.listInvitations({
        repo: this.serverSettingsStore.serverData.name,
        owner: this.serverSettingsStore.serverData.owner
      })).data.map(r => ({name: r.invitee.login, avatarUrl: r.invitee.avatar_url, status: "inviting", invitationId: r.id})))
      this.collaborators = this.collaborators.filter(u => !this.deletedCollaborator.includes(u.name))
    },
    save() {
      this.serverSettingsStore.serverData = {
        name: this.serverSettingsStore.serverData.name,
        path: this.serverSettingsStore.serverData.path,
        url: this.serverSettingsStore.serverData.url,
        maxMem: this.maxMem,
        minMem: this.minMem,
        command: this.command,
        repositoryId: this.serverSettingsStore.serverData.repositoryId,
        owner: this.serverSettingsStore.serverData.owner,
      }
      this.datas[this.serverSettingsStore.serverData.repositoryId] = {
        name: this.serverSettingsStore.serverData.name,
        path: this.serverSettingsStore.serverData.path,
        url: this.serverSettingsStore.serverData.url,
        maxMem: this.maxMem,
        minMem: this.minMem,
        command: this.command,
        repositoryId: this.serverSettingsStore.serverData.repositoryId,
        owner: this.serverSettingsStore.serverData.owner,
      }

      try {
        window.file.save(this.serversPath, JSON.stringify(this.datas))
        this.setSnackbar("保存しました")
      }
      catch (error) {
        console.log(error)
        this.setError("保存に失敗しました")
      }
    },
    openFolder() {
      window.shell.showItemInFolder(this.serverSettingsStore.serverData.path)
    },
    setOverlay(message: string) {
      this.overlay = true
      this.overlayMessage = message
    },
    setSnackbar(message: string) {
      this.snackbarMessage = message
      this.snackbar = true
      this.overlay = false
    },
    deleteDirectory() {
      this.directoryDialog = false
      this.setOverlay("削除中")
      try {
        window.file.rm(this.serverSettingsStore.serverData.path)
      }
      catch(error) {
        console.log(error)
        this.setError("フォルダの削除に失敗しました")
        return
      }

      delete this.datas[this.serverSettingsStore.serverData.repositoryId]
      try {
        window.file.save(this.serversPath, JSON.stringify(this.datas))
      }
      catch (error) {
        console.log(error)
        this.setError("保存に失敗しました")
        return
      }

      this.overlay = false
      this.serverSettingsStore.deleted = true
      this.router.push("/")
    },
    async deleteRepository() {
      this.repositoryDialog = false
      this.setOverlay("削除中")
      try {
        window.file.rm(this.serverSettingsStore.serverData.path)
      }
      catch(error) {
        console.log(error)
        this.setError("フォルダの削除に失敗しました")
        return
      }

      try {
        await this.githubStore.octokit.repos.delete({owner: this.serverSettingsStore.serverData.owner, repo: this.serverSettingsStore.serverData.name})
      }
      catch (error) {
        console.log(error)
        this.setError("リポジトリの削除に失敗しました")
        return
      }

      delete this.datas[this.serverSettingsStore.serverData.repositoryId]
      try {
        window.file.save(this.serversPath, JSON.stringify(this.datas))
      }
      catch (error) {
        console.log(error)
        this.setError("保存に失敗しました")
        return
      }

      this.overlay = false
      this.serverSettingsStore.deleted = true
      this.router.push("/")
    },
    setError(errorMessage: string) {
      this.errorMessage = `エラーが発生しました${errorMessage ? "\n" + errorMessage : ""}`
      this.errorSnackbar = true
      this.overlay = false
    },
    checkRollback(commit: object) {
      this.commit = commit
      this.rollbackDialog = true
    },
    async rollback() {
      this.rollbackDialog = false
      this.setOverlay("ロールバック中")

      if (!(await window.git.status(this.serverSettingsStore.serverData.path)).isClean()) {
        try {
          await window.git.commit(this.serverSettingsStore.serverData.path, "変更をアップロード")
        }
        catch (error) {
          console.log(error)
          this.setError("変更の保存に失敗しました")
          return
        }
      }

      try {
        await window.git.revert(this.serverSettingsStore.serverData.path, this.commit.hash)
      }
      catch(error) {
        console.log(error)
        this.setError("ロールバックに失敗しました")
        return
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, `以前の状態にロールバック： ${this.commit.message} - ${this.commit.author} (${this.commit.time})`)
      }
      catch(error) {
        console.log(error)
        this.setError("ロールバックのアップロードに失敗しました")
        return
      }

      await this.setCommitLog()
      this.setStatus()
      this.setSnackbar("以前の状態に戻しました")
      this.overlay = false
    },
    async upload() {
      this.setOverlay("アップロード中")

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "データ更新")
      }
      catch (error) {
        console.log(error)
        this.setError("アップロードに失敗しました")
        return
      }

      await this.setCommitLog()
      this.setStatus()
      this.setSnackbar("アップロードしました")
      this.overlay = false
    },
    async download() {
      this.setOverlay("ダウンロード中")

      try {
        await window.git.download(this.serverSettingsStore.serverData.path)
      }
      catch (error) {
        console.log(error)
        this.setError("ダウンロードに失敗しました")
        return
      }

      await this.setCommitLog()
      this.setStatus()
      this.setSnackbar("ダウンロードしました")
      this.overlay = false
    },
    async forceUpload() {
      this.forceUploadDialog = false
      this.setOverlay("アップロード中")

      try {
        await window.git.forceUpload(this.serverSettingsStore.serverData.path, "強制データ更新")
      }
      catch (error) {
        console.log(error)
        this.setError("アップロードに失敗しました")
        return
      }

      await this.setCommitLog()
      this.setStatus()
      this.setSnackbar("アップロードしました")
      this.overlay = false
    },
    async forceDownload() {
      this.forceDownloadDialog = false
      this.setOverlay("ダウンロード中")

      try {
        await window.git.forceDownload(this.serverSettingsStore.serverData.path)
      }
      catch (error) {
        console.log(error)
        this.setError("ダウンロードに失敗しました")
        return
      }

      await this.setCommitLog()
      this.setStatus()
      this.setSnackbar("ダウンロードしました")
      this.overlay = false
    },
    async addCollaborator() {
      this.setOverlay("ユーザー追加中")

      try {
        await this.githubStore.octokit.users.getByUsername({username: this.userName})
      }
      catch (error) {
        if (error.status === 404) {
          this.found = false
          this.overlay = false
          return
        }

        console.log(error)
        this.setError("ユーザー情報を取得できませんでした")
        return
      }

      try {
        await this.githubStore.octokit.repos.addCollaborator({
          owner: this.serverSettingsStore.serverData.owner,
          repo: this.serverSettingsStore.serverData.name,
          username: this.userName
        })
      }
      catch (error) {
        console.log(error)
        this.setError("ユーザーを追加できませんでした")
        return
      }

      await this.setCollaborators()
      this.found = true
      this.userName = ""
      this.setSnackbar("ユーザーに招待を送りました\n相手が招待を受け入れることでサーバーデータにアクセスすることができるようになります")
      this.overlay = false
    },
    async deleteCollaborator() {
      this.deleteCollaboratorDialog = false
      this.setOverlay("ユーザー削除中")

      if (this.collaborator.status === "joined") {
        try {
          await this.githubStore.octokit.rest.repos.deleteCollaborator({
            repo: this.serverSettingsStore.serverData.name,
            owner: this.serverSettingsStore.serverData.owner,
            username: this.collaborator.name
          })
        }
        catch (error) {
          console.log(error)
          this.setError("ユーザーの削除に失敗しました")
          return
        }

        this.setSnackbar(`${this.collaborator.name}さんを削除しました`)
      }
      else if (this.collaborator.status === "inviting") {
        try {
          await this.githubStore.octokit.rest.repos.deleteInvitation({
            repo: this.serverSettingsStore.serverData.name,
            owner: this.serverSettingsStore.serverData.owner,
            invitation_id: this.collaborator.invitationId
          })
        }
        catch (error) {
          console.log(error)
          this.setError("招待の削除に失敗しました")
          return
        }

        this.deletedCollaborator.push(this.collaborator.name)
        await this.setCollaborators()
        this.setSnackbar(`${this.collaborator.name}さんの招待を削除しました`)
        this.overlay = false
      }
    },
    checkDeleteCollaborator(user) {
      this.collaborator = user
      this.deleteCollaboratorDialog = true
    },
    async run() {
      if (this.runningStore.isRunning) return

      if (!this.serverSettingsStore.serverData.command) {
        this.setError("起動コマンドが設定されていません")
        return
      }

      this.setOverlay("サーバー起動中")

      let icon = null
      if (window.file.exists(window.file.join(this.serverSettingsStore.serverData.path, "server-icon.png")))
        icon = window.file.load(window.file.join(this.serverSettingsStore.serverData.path, "server-icon.png"), "base64")
      const result = await this.runningStore.run(this.serverSettingsStore.serverData, icon, window)

      if (!result) {
        this.router.push("/running")
        return
      }

      if (result === "#downloadError") this.setError("データの同期に失敗しました\n時間をあけてもう一度実行しても解決しない場合、強制ダウンロードを行ってください")
      else if (result === "#runningError") this.setError("他のサーバーが起動中です")
      else if (result === "#githubError") this.setError("GitHubのログインに失敗しました")
      else if (result === "#loadError") this.setError("状態の読み込みに失敗しました")
      else if (result === "#saveError") this.setError("状態の保存に失敗しました")
      else if (result === "#uploadError") this.setError("状態の同期に失敗しました")
      else if (result === "#ngrokError") this.setError("Ngrokの起動に失敗しました\nNgrokの設定を見直してください")
      else this.setError(`${result}さんが起動中です`)
    },
    async stop() {
      if (this.status !== this.githubStore.userData.login || this.runningStore.isRunning) return

      this.setOverlay("停止済みに更新中")

      try {
        await this.runningStore.stop(this.serverSettingsStore.serverData.path, window)
      }
      catch(error) {
        console.log(error)
        this.setError("状態の更新に失敗しました")
        return
      }

      await this.setCommitLog()
      this.status = "#stopping"
      this.setSnackbar("状態を更新しました")
    },
    async importCommand() {
      let script
      try {
        const paths = (await window.file.selectFilePath(this.serverSettingsStore.serverData.path))
        if (!paths) return
        script = window.file.load(paths[0], "utf-8")
      }
      catch (error) {
        console.log(error)
        this.setError("ファイルの読み込みに失敗しました")
        return
      }

      let notFound = true
      let lines = script.split("\n")
      for (let l of lines) {
        if (l.startsWith("java")) {
          notFound = false
          this.command = l
        }
      }

      if (notFound) this.setError("起動コマンドが見つかりませんでした")
    }
  },
  computed: {
    isChanged() {
      let isChanged = false
      isChanged = isChanged || this.maxMem !== this.serverSettingsStore.serverData.maxMem
      isChanged = isChanged || this.minMem !== this.serverSettingsStore.serverData.minMem
      isChanged = isChanged || this.command !== this.serverSettingsStore.serverData.command

      return isChanged
    }
  },
})
</script>

<template>
  <v-row>
    <v-col>
      <h1>サーバー設定</h1>
    </v-col>
  </v-row>

  <v-tabs
      v-model="tab"
      align-tabs="center"
      color="primary"
  >
    <v-row justify="space-evenly">
      <v-col cols="4"><v-tab :value="1" width="100%" prepend-icon="mdi-cog"><h3>基本設定</h3></v-tab></v-col>
      <v-col cols="4"><v-tab :value="2" width="100%" prepend-icon="mdi-file-cog-outline"><h3>プロパティ</h3></v-tab></v-col>
      <v-col cols="4"><v-tab :value="3" width="100%" prepend-icon="mdi-earth"><h3>ワールド・データパック</h3></v-tab></v-col>
    </v-row>
  </v-tabs>

  <v-window v-model="tab" class="mt-8">
    <v-window-item :value="1">
      <div v-if="serverSettingsStore.serverData">
        <div class="d-flex flex-row align-center">
          <v-img rounded inline class="mr-4" :src="icon ? `data:image/png;base64,${icon}` : 'https://raw.githubusercontent.com/yadokari1130/EnderLink/master/public/pack.png'" width="128px" height="128px"></v-img>
          <h2>サーバー名：{{serverSettingsStore.serverData.name}}</h2>
        </div>

        <v-tooltip :disabled="!runningStore.isRunning" location="bottom">
          <template v-slot:activator="{props}">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  width="100%"
                  size="large"
                  class="mt-4"
                  prepend-icon="mdi-play"
                  color="primary"
                  @click="run"
                  :disabled="runningStore.isRunning"
              >起動</v-btn>
            </div>
          </template>
          <p>他のサーバーが起動中です</p>
          <p>複数のサーバーを同時に起動させることはできません</p>
        </v-tooltip>
        <v-tooltip location="bottom">
          <template v-slot:activator="{props}">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  width="100%"
                  size="large"
                  class="mt-4"
                  prepend-icon="mdi-stop"
                  color="error"
                  variant="outlined"
                  @click="stop"
                  :disabled="this.status !== this.githubStore.userData.login || this.runningStore.isRunning"
              >停止済みにする</v-btn>
            </div>
          </template>
          <div v-if="this.status === '#stopping'">
            <p>すでに停止済みです</p>
          </div>
          <div v-else-if="this.status !== this.githubStore.userData.login">
            <p>他の人が起動中です</p>
            <p>停止済みにできるのは自分が起動している状態になっているものの、実際は起動していないときのみです</p>
          </div>
          <div v-else-if="runningStore.isRunning">
            <p>サーバーが起動中です</p>
            <p>サーバーを停止してください</p>
          </div>
          <div v-else>
            <p>サーバーを停止済みにし、データを同期します</p>
            <p>サーバーを起動したままアプリケーションを終了してしまった場合など、</p>
            <p>自分が起動した状態になっているものの、実際は起動していないときに状態を更新します</p>
          </div>
        </v-tooltip>

        <h2 class="mt-16 ma-4">基本設定</h2>
        <div class="pa-4 rounded border">
          <v-row>
            <v-col cols="10" align-self="center">
              <p>ディレクトリ：{{serverSettingsStore.serverData.path}}</p>
            </v-col>
            <v-col cols="2">
              <v-btn width="100%" color="primary" size="large" @click="openFolder">開く</v-btn>
            </v-col>
          </v-row>

          <v-row>
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
                  :hide-details="true"
                  placeholder="例：java -jar server.jar nogui">
                <template v-slot:append>
                  <v-tooltip location="bottom">
                    <template v-slot:activator="{props}">
                      <v-btn
                          size="large"
                          color="primary"
                          style="text-transform: none"
                          v-bind="props"
                          @click="importCommand"
                          variant="text"
                      >batからインポート</v-btn>
                    </template>
                    <p>シェルスクリプトからもインポートすることができます</p>
                  </v-tooltip>
                </template>
              </v-text-field>
            </v-col>
          </v-row>

          <v-row justify="end">
            <v-col cols="2">
              <v-btn @click="save" color="primary" size="large" width="100%">保存</v-btn>
            </v-col>
          </v-row>
        </div>

        <h2 class="mt-16 ma-4">データ管理</h2>
        <div class="rounded border pa-4">
          <v-row>
            <v-col cols="6">
              <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                      width="100%"
                      color="primary"
                      v-bind="props"
                      size="large"
                      @click="upload"
                  >データをアップロード</v-btn>
                </template>
                <p>データに矛盾がない場合、GitHubにデータをアップロードします</p>
                <p>サーバー終了後に自動でアップロードされるため</p>
                <p>基本的に行う必要はありません</p>
              </v-tooltip>
            </v-col>
            <v-col cols="6">
              <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                      width="100%"
                      color="primary"
                      v-bind="props"
                      size="large"
                      @click="download"
                  >データをダウンロード</v-btn>
                </template>
                <p>データに矛盾がない場合、GitHubにデータをアップロードします</p>
                <p>サーバー起動前に自動でダウンロードされるため</p>
                <p>基本的に行う必要はありません</p>
              </v-tooltip>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="6">
              <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                      width="100%"
                      variant="outlined"
                      color="error"
                      size="large"
                      v-bind="props"
                      @click="forceUploadDialog = true"
                  >データを強制的にアップロード</v-btn>
                </template>
                <p>データをGitHubに強制的にアップロードします</p>
                <p><strong>他の参加者全員が強制的にダウンロードする必要があります</strong></p>
                <p><strong>なにか問題が起きているときのみアップロードしてください</strong></p>
              </v-tooltip>
            </v-col>
            <v-col cols="6">
              <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                      width="100%"
                      variant="outlined"
                      color="error"
                      size="large"
                      v-bind="props"
                      @click="forceDownloadDialog = true"
                  >データを強制的にダウンロード</v-btn>
                </template>
                <p>パソコンのデータをGitHubのデータで強制的に上書きします</p>
                <p><strong>保存していないデータは失われます</strong></p>
                <p><strong>なにか問題が起きているときのみダウンロードしてください</strong></p>
              </v-tooltip>
            </v-col>
          </v-row>
        </div>

        <h2 class="mt-16 ma-4">操作履歴</h2>
        <div class="pa-4 rounded border">
          <v-row>
            <v-data-table
                :items="commitLog"
                :headers="[
              {title: 'ユーザー', key: 'author', width: '15%'},
              {title: '時間', key: 'time', width: '15%'},
              {title: 'コメント', key: 'message', width: '65%'},
              {title: '操作', key: 'actions', align: 'center', sortable: false, width: '5%'},
          ]"
            >
              <template v-slot:item.actions="{item}">
                <v-btn
                    variant="text"
                    color="error"
                    @click="checkRollback(item)"
                >戻す</v-btn>
              </template>
            </v-data-table>
          </v-row>
        </div>

        <h2 class="mt-16 ma-4">サーバー管理者</h2>
        <div class="pa-4 rounded border">
          <v-row>
            <v-col cols="12">
              <v-text-field
                  variant="outlined"
                  @input="found = true"
                  :error-messages="found ? null : 'ユーザーが見つかりませんでした'"
                  v-model="userName"
                  @keyup.enter="addCollaborator"
                  label="ユーザー名"
              >
                <template v-slot:append>
                  <v-tooltip location="bottom" :disabled="serverSettingsStore.serverData.owner === githubStore.userData.login">
                    <template v-slot:activator="{ props }">
                      <div v-bind="props" class="d-inline-block" style="width: 100%;">
                        <v-btn
                            size="large"
                            color="primary"
                            width="100%"
                            @click="addCollaborator"
                            :disabled="serverSettingsStore.serverData.owner !== githubStore.userData.login"
                        >ユーザー追加</v-btn>
                      </div>
                    </template>
                    <p>ユーザーを追加できるのは最初に作成した所有者のみです</p>
                  </v-tooltip>
                </template>
              </v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-data-table
                :items="collaborators"
                :headers="[
            {title: 'ユーザー', key: 'user', width: '85%'},
            {title: '状態', key: 'status', width: '10%', align: 'center'},
            {title: '操作', key: 'actions', align: 'center', width: '5%', sortable: false}
        ]"
            >
              <template v-slot:item.user="{item}">
                <div class="d-flex flex-row align-center">
                  <v-avatar rounded="50%" :image="item.avatarUrl" size="48" class="ma-2 mr-4"/>
                  <h3>{{item.name}}</h3>
                </div>
              </template>
              <template v-slot:item.status="{item}">
                <p>{{jpStatus[item.status]}}</p>
              </template>
              <template v-slot:item.actions="{item}">
                <v-btn
                    variant="text"
                    color="error"
                    @click="checkDeleteCollaborator(item)"
                    :disabled="item.name === githubStore.userData.login || serverSettingsStore.serverData.owner !== githubStore.userData.login"
                >削除</v-btn>
              </template>
            </v-data-table>
          </v-row>
        </div>

        <v-row class="mt-16">
          <v-col cols="6">
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                    variant="outlined"
                    color="error"
                    size="large"
                    width="100%"
                    v-bind="props"
                    @click="() => {directoryDialog = true}"
                >
                  パソコンから削除
                </v-btn>
              </template>
              <p>パソコンからサーバーデータを削除します</p>
              <p>GitHubには残るので、もう一度GitHubから</p>
              <p>インポートすることでサーバーで遊ぶことができます</p>
            </v-tooltip>
          </v-col>
          <v-col cols="6">
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <div v-bind="props" class="d-inline-block" style="width: 100%;">
                  <v-btn
                      variant="outlined"
                      color="error"
                      size="large"
                      width="100%"
                      :disabled="serverSettingsStore.serverData.owner !== githubStore.userData.login"
                      @click="() => {repositoryDialog = true}"
                  >
                    GitHubから削除
                  </v-btn>
                </div>
              </template>
              <div v-if="serverSettingsStore.serverData.owner !== githubStore.userData.login">
                <p>GitHubのデータを削除できるのは</p>
                <p>最初に作成した所有者のみです</p>
              </div>
              <div v-else>
                <p>GitHubのデータを完全に消去します</p>
                <p><strong>データがもとに戻ることはありません</strong></p>
                <p><strong>削除する際は問題がないか十分に確認してください</strong></p>
              </div>
            </v-tooltip>
          </v-col>
        </v-row>
      </div>
    </v-window-item>

    <v-window-item :value="2">
      <server-properties
          @set-overlay="setOverlay"
          @set-error="setError"
          @set-snackbar="setSnackbar"
      />
    </v-window-item>

    <v-window-item :value="3">
      <world-settings
          @set-overlay="setOverlay"
          @set-error="setError"
          @set-snackbar="setSnackbar"
          @set-commit-log="setCommitLog"
      />
    </v-window-item>
  </v-window>

  <v-dialog
      v-model="directoryDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="パソコンから削除">
      <v-card-text>
        <p>本当にパソコンから削除しますか？</p>
        <p>もう一度GitHubからインポートすることでサーバーで遊ぶことができます</p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="() => {directoryDialog = false}"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="deleteDirectory"
            size="large"
            color="red"
        >削除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
      v-model="repositoryDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="GitHubから削除">
      <v-card-text>
        <p>本当にGitHubから削除しますか？</p>
        <p><strong>データがもとに戻ることはありません</strong></p>
        <p><strong>削除する際は問題がないか十分に確認してください</strong></p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="() => {repositoryDialog = false}"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="deleteRepository"
            size="large"
            color="red"
        >削除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
      v-model="rollbackDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="ロールバック">
      <v-card-text>
        <p>本当に以下の状態に戻しますか？</p>
        <p>{{commit.message}} - {{commit.author}} ({{commit.time}})</p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="() => {rollbackDialog = false}"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="rollback"
            size="large"
            color="red"
        >戻す</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
      v-model="forceUploadDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="強制アップロード">
      <v-card-text>
        <p>GitHubのデータをパソコンのデータで強制的に上書きします</p>
        <p>本当に強制アップロードしますか？</p>
        <p><strong>他の参加者全員が強制的にダウンロードする必要があります</strong></p>
        <p><strong>なにか問題が起きているときのみアップロードしてください</strong></p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="forceUploadDialog = false"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="forceUpload"
            size="large"
            color="red"
        >アップロード</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
      v-model="forceDownloadDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="強制ダウンロード">
      <v-card-text>
        <p>パソコンのデータをGitHubのデータで強制的に上書きします</p>
        <p>本当に強制ダウンロードしますか？</p>
        <p><strong>保存していないデータは失われます</strong></p>
        <p><strong>なにか問題が起きているときのみダウンロードしてください</strong></p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="forceDownloadDialog = false"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="forceDownload"
            size="large"
            color="red"
        >ダウンロード</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
      v-model="deleteCollaboratorDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="ユーザー削除">
      <v-card-text>
        <p>本当に{{collaborator.name}}さんを削除しますか？</p>
        <p><strong>今後サーバーデータにアクセスすることができなくなりますが、すでにダウンロードされたデータはパソコン上に残り続けます</strong></p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="deleteCollaboratorDialog = false"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="deleteCollaborator"
            size="large"
            color="red"
        >削除</v-btn>
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
      >閉じる</v-btn>
    </template>
  </v-snackbar>

  <v-snackbar
    v-model="isChanged"
    :disabled="overlay"
    timeout="-1"
    multi-line
  >
    <p>設定が保存されていません</p>
    <template v-slot:actions>
      <v-btn
        variant="text"
        @click="save"
      >保存</v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>

</style>