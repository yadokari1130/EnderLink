<script lang="ts">
import { defineComponent } from 'vue'
import { useGitHubStore } from "../store/github";
import {IShell, IFile, IToken} from "../@types/global";
import { useNgrokStore } from "../store/ngrok";
import { useRunningStore } from "../store/running";
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"

export default defineComponent({
  name: "Settings",
  methods: {
    async login() {
      this.errorSnackbar = false
      const error = await this.githubStore.login(window)
      if (error) {
        console.log(error)
        this.setError("ログインに失敗しました")
      }
    },
    setError(errorMessage: string) {
      this.errorMessage = errorMessage
      this.errorSnackbar = true
      this.overlay = false
    },
    async logout() {
      await this.githubStore.logout(window)
    },
    async registerSSH() {
      this.setOverlay("SSHキー登録中")
      const sshDir = await window.file.getUserDataPath("ssh")
      try {
        window.file.mkdir(sshDir)
        window.file.rm(await window.file.getUserDataPath("ssh", "id_ed25519"))
        window.file.rm(await window.file.getUserDataPath("ssh", "id_ed25519.pub"))
        window.command.execSync(`cd ${window.shell.getPlatform() === "win32" ? "/d" : ""} "${sshDir}" && ssh-keygen -t ed25519 -f id_ed25519 -N ""`)
      }
      catch (error) {
        console.log(error)
        this.setError("SSHキーの作成に失敗しました")
        return
      }

      try {
        await this.githubStore.octokit.rest.users.createPublicSshKeyForAuthenticatedUser({
          title: `enderlink_${new Date().getTime()}`,
          key: window.file.load(await window.file.getUserDataPath("ssh", "id_ed25519.pub"), "utf-8")
        })
      }
      catch (error) {
        console.log(error)
        this.setError("SSHキーの登録に失敗しました")
        return
      }

      try {
        if (this.isWin) {
          let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.bat")
          await window.shell.openPath(shPath)
        }
        else {
          let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.sh")
          await window.shell.showItemInFolder(shPath)
        }
      }
      catch (error) {
        console.log(error)
        this.setError("ファイルのオープンに失敗しました")
      }

      this.overlay = false
      this.sshSnackbar = true
    },
    openExternal(url: string) {
      window.shell.openExternal(url)
    },
    setSnackbar(message: string) {
      this.snackbar = true
      this.snackbarMessage = message
      this.overlay = false
    },
    async saveAppSettings() {
      try {
        await window.store.set("startPath", this.startPath)
      }
      catch (error) {
        console.log(error)
        this.setError("設定の保存に失敗しました")
      }
    },
    setOverlay(message: string) {
      this.overlay = true
      this.overlayMessage = message
    },
    async installGit() {
      this.term = new Terminal()
      this.$refs.terminal.innerHTML = ""
      window.command.spawn("winget install --id Git.Git -e --source winget", ".",
          data => {
            this.term.write(data)
            console.log(data)
          },
          data => {
            this.term.write(data)
            console.log(data)
          },
          async code => {
            await this.githubStore.init(window)
            this.installing = false
          }
      )
      this.term.open(this.$refs.terminal)
    },
    async installAmazonCorretto() {
      this.term = new Terminal()
      this.$refs.terminal.innerHTML = ""
      window.command.spawn(`winget install --id Amazon.Corretto.${this.javaVersion} -e --source winget`, ".",
          data => {
            this.term.write(data)
            console.log(data)
          },
          data => {
            this.term.write(data)
            console.log(data)
          },
          async code => {
            this.getJavaVersion()
            this.installing = false
          }
      )
      this.term.open(this.$refs.terminal)
    },
    getJavaVersion() {
      try {
        this.installedJava = window.command.spawnSync("java -version")[1].split("\n")[0]
      }
      catch (error) {
        console.log(error)
        this.installedJava = null
      }
    },
    sendCommand() {
      this.term.write(this.command)
      window.command.write(this.command)
      this.command = ""
    },
  },
  data: (): {
    errorMessage: string,
    errorSnackbar: boolean,
    githubStore: any,
    ngrokStore: any,
    snackbar: boolean,
    snackbarMessage: string,
    runningStore: any,
    isWin: boolean,
    sshSnackbar: boolean,
    windowMaximize: boolean,
    overlay: boolean,
    overlayMessage: string,
    tab: number,
    installing: boolean,
    command: string,
    term: Terminal | null,
    startPath: string,
    javaVersion: string,
    installedJava: string | null,
    changeJavaVersion: boolean
  } => ({
    errorMessage: "",
    errorSnackbar: false,
    githubStore: useGitHubStore(),
    ngrokStore: useNgrokStore(),
    snackbar: false,
    snackbarMessage: "",
    runningStore: useRunningStore(),
    isWin: false,
    sshSnackbar: false,
    windowMaximize: false,
    overlay: false,
    overlayMessage: "",
    tab: 1,
    installing: false,
    command: "",
    term: null,
    startPath: "",
    javaVersion: "21",
    installedJava: null,
    changeJavaVersion: false
  }),
  async created() {
    await this.githubStore.fetchData(window)
    await this.ngrokStore.fetchData(window)
    this.isWin = window.shell.getPlatform() === "win32"
    this.windowMaximize = (await window.store.get("windowMaximize")) === "true"
    this.startPath = await window.store.get("startPath")
    this.getJavaVersion()
  }
})
</script>

<template>
  <v-row class="mb-6">
    <v-col>
      <h1>基本設定</h1>
    </v-col>
  </v-row>

  <h2 class="ma-4">GitHub</h2>
  <div class="border rounded pa-4">
    <div v-if="githubStore.userData">
      <div class="d-flex flex-row align-center">
        <v-img inline :src="githubStore.userData.avatar_url" width="128px" rounded class="mr-4"/>
        <div class="align-center">
          <h2>{{githubStore.userData.login}}</h2>
          <p>{{githubStore.userData.email}}</p>
        </div>
      </div>

      <v-row justify="space-between" class="mt-8">
        <v-col cols="4">
          <v-tooltip location="bottom">
            <template v-slot:activator="{props}">
              <v-btn
                  @click="registerSSH"
                  color="primary"
                  size="large"
                  width="100%"
                  v-bind="props"
              >SSHキーを登録</v-btn>
            </template>
            <p>GitHubとデータのやり取りをするためにSSHキーを登録する必要があります</p>
            <p>このアプリ専用のSSHキーを発行するため、すでにSSHキーが登録されている場合でも新しく登録してください</p>
          </v-tooltip>
        </v-col>
        <v-col cols="4">
          <v-btn variant="outlined" color="red" @click="logout" size="large" width="100%">ログアウト</v-btn>
        </v-col>
      </v-row>

      <h3 class="mt-4 mb-2">Git：{{githubStore.gitVersion ? `インストール済み (${githubStore.gitVersion})` : "未インストール"}}</h3>
      <v-tooltip location="bottom" v-if="isWin">
        <template v-slot:activator="{props}">
          <div class="d-inline-block" v-bind="props" style="width: 100%">
            <v-btn
                width="100%"
                size="large"
                color="primary"
                @click="() => {this.installing = true; this.installGit()}"
                style="text-transform: none"
                :disabled="runningStore.isRunning"
            >
              Gitをインストール
            </v-btn>
          </div>
        </template>
        <div>
        <p>Gitはデータの管理に必要なアプリです</p>
        <p v-if="runningStore.isRunning">起動中のサーバーを停止してください</p>
        </div>
      </v-tooltip>
    </div>

    <v-btn
        @click="login"
        size="x-large"
        append-icon="mdi-open-in-new"
        width="100%"
        color="primary"
        v-else
    >GitHubでログイン</v-btn>
  </div>

  <h2 class="ma-4">Java</h2>
  <div class="border rounded pa-4">
    <h3 class="mt-4 mb-2">Java：{{installedJava ? `インストール済み (${installedJava})` : "未インストール"}}</h3>
    <div class="d-inline-block" v-if="isWin" style="width: 100%">
      <div class="d-flex flex-row align-center">
        <v-checkbox-btn v-model="changeJavaVersion">
          <template v-slot:label>
            <p>インストールするバージョンを切り替え</p>
            <v-tooltip location="bottom">
              <template v-slot:activator="{props}">
                <v-icon v-bind="props" size="large" class="ml-2">mdi-help-circle-outline</v-icon>
              </template>
              <p>バニラで遊ぶ場合、どのMinecraftのバージョンであっても基本的にJavaのバージョン切り替えは不要です</p>
              <p>Forgeなどで遊ぶ場合はForgeのバージョンにあったJavaのバージョンを選択してください</p>
            </v-tooltip>
          </template>
        </v-checkbox-btn>
      </div>
      <v-select
          label="Javaバージョン"
          :items="['21', '17', '11', '8']"
          v-model="javaVersion"
          v-if="changeJavaVersion"
          variant="outlined"
      />
      <v-tooltip location="bottom">
        <template v-slot:activator="{props}">
          <div class="d-inline-block" v-bind="props" style="width: 100%">
            <v-btn
                width="100%"
                size="large"
                color="primary"
                @click="() => {this.installing = true; this.installAmazonCorretto()}"
                style="text-transform: none"
                :disabled="runningStore.isRunning"
            >
              Javaをインストール
            </v-btn>
          </div>
        </template>
        <div>
          <p>Javaはサーバーの起動に必要なプログラムです</p>
          <p v-if="runningStore.isRunning">起動中のサーバーを停止してください</p>
        </div>
      </v-tooltip>
    </div>
  </div>

  <h2 class="ma-4">アプリケーション設定</h2>
  <div class="border rounded pa-4">
    <p>初期ページ</p>
    <v-radio-group
        class="mt-8"
        v-model="startPath"
        @change="saveAppSettings"
    >
      <v-radio label="サーバー一覧(主にサーバー管理を行う方向け)" value="/"/>
      <v-radio label="ポート開放不要機能(サーバー管理は行わず、主に他のサーバーに接続する方向け)" value="/cloudflare-tunnel"/>
    </v-radio-group>
  </div>

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
      v-model="errorSnackbar"
      timeout="-1"
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
    v-model="sshSnackbar"
    timeout="-1"
    multi-line
  >
    <div v-if="isWin">
      <p>SSHキーを登録しました</p>
      <p>黒いターミナル画面が表示された場合、以下の文字列が出力されていることを確認し、「yes」と入力してエンターを押してください</p>
      <p>なお、黒いターミナル画面は表示されない場合もありますが、その場合も登録は完了しています</p>
      <p>ECDSA key fingerprint is SHA256:p2QAMXNIC1TJYWeIOttrVc98/R1BUFWu3/LiyKgUfQM.</p>
    </div>
    <div v-else>
      <p>SSHキーを登録しました</p>
      <p>開かれたフォルダ内にある「hostbasedAuth.sh」を実行した後、</p>
      <p>以下の文字列が出力されていることを確認し、「yes」と入力してエンターを押してください</p>
      <p>ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.</p>
    </div>
    <template v-slot:actions>
      <v-btn
          variant="text"
          @click="sshSnackbar = false"
      >
        閉じる
      </v-btn>
    </template>
  </v-snackbar>

  <v-row justify="center">
    <v-dialog
      v-model="installing"
      persistent
      width="800px"
      transition="slide-y-transition"
      :eager="true"
    >
      <v-card>
        <v-card-title class="text-h5">
          Gitのインストール
        </v-card-title>
        <v-card-text>
          <div ref="terminal"/>
        </v-card-text>
        <v-card-actions>
          <v-text-field
              v-model="command"
              density="comfortable"
              prepend-icon="mdi-play"
              variant="outlined"
              @keydown.enter="sendCommand"
              @click:prepend="sendCommand"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<style scoped>

</style>