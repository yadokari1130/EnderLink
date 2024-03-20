<script lang="ts">
import { defineComponent } from 'vue'
import axios from "axios";
import { useGitHubStore } from "../store/github";
import {IShell, IFile, IToken} from "../@types/global";
import { useNgrokStore } from "../store/ngrok";

export default defineComponent({
  name: "Settings",
  methods: {
    async login() {
      this.errorSnackbar = false
      const error = await this.githubStore.login(window)
      if (error) {
        this.errorSnackbar = true
        this.errorMessage = error
      }
    },
    setError(errorMessage: string) {
      this.errorMessage = `ログインに失敗しました${errorMessage ? "\n" + errorMessage : ""}`
      this.errorSnackbar = true
    },
    async logout() {
      await this.githubStore.logout(window)
    },
    async registerSSH() {
      this.registeringSSH = true
      const sshDir = await window.file.getUserDataPath("ssh")
      try {
        window.file.mkdir(sshDir)
        window.file.rm(await window.file.getUserDataPath("ssh", "id_ed25519"))
        window.file.rm(await window.file.getUserDataPath("ssh", "id_ed25519.pub"))
        window.command.execSync(`cd ${sshDir} && ssh-keygen -t ed25519 -f id_ed25519 -N ""`)
      }
      catch (error) {
        console.log(error)
        this.setError("SSHキーの作成に失敗しました")
        this.registeringSSH = false
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
        this.registeringSSH = false
        return
      }

      this.setSnackbar("SSHキーを登録しました")
      this.registeringSSH = false
    },
    openExternal(url: string) {
      window.shell.openExternal(url)
    },
    save() {
      this.ngrokStore.save(window)
    },
    setSnackbar(message: string) {
      this.snackbar = true
      this.snackbarMessage = message
    },
  },
  data: (): {
    errorMessage: string,
    errorSnackbar: boolean,
    githubStore: any,
    registeringSSH: boolean,
    ngrokStore: any,
    snackbar: boolean,
    snackbarMessage: string
  } => ({
    errorMessage: "",
    errorSnackbar: false,
    githubStore: useGitHubStore(),
    registeringSSH: false,
    ngrokStore: useNgrokStore(),
    snackbar: false,
    snackbarMessage: ""
  }),
  async created() {
    await this.githubStore.fetchData()
    await this.ngrokStore.fetchData(window)
  }
})
</script>

<template>
  <v-row class="mb-6">
    <v-col>
      <h1>基本設定</h1>
    </v-col>
  </v-row>

  <div v-if="githubStore.userData">
    <h2 class="ma-4">ログイン中のアカウント</h2>
    <div class="border rounded pa-4">
      <div class="d-flex flex-row align-center">
        <v-img inline :src="githubStore.userData.avatar_url" width="128px" rounded class="mr-4"/>
        <div class="align-center">
          <h2>{{githubStore.userData.login}}</h2>
          <p>{{githubStore.userData.email}}</p>
        </div>
      </div>

      <v-row class="mt-8" justify="space-between">
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
    </div>
  </div>

  <v-row v-else>
    <v-col>
      <v-btn @click="login" size="x-large" append-icon="mdi-open-in-new">GitHubでログイン</v-btn>
    </v-col>
  </v-row>

  <h2 class="ma-4 mt-16">
    Ngrok
    <v-tooltip location="bottom">
      <template v-slot:activator="{props}">
        <v-icon v-bind="props" class="ml-4">mdi-help-circle-outline</v-icon>
      </template>
      <p>ポート開放をせずにサーバーを公開することができるアプリケーションです</p>
      <p>この機能を使うためにはNgrokをインストールする必要があります</p>
    </v-tooltip>
  </h2>
  <div class="border rounded pa-4">
    <v-btn
        @click="openExternal('https://ngrok.com/download')"
        size="large"
        width="100%"
        color="primary"
        class="mb-4"
        append-icon="mdi-open-in-new"
    >Ngrokをインストールする</v-btn>
    <v-checkbox hide-details label="Ngrokを使う" @change="save" v-model="ngrokStore.useNgrok" class="mb-4"/>
    <v-text-field variant="outlined" label="トークン" hide-details v-model="ngrokStore.ngrokToken" @input="save">
      <template v-slot:append>
        <v-btn
            size="large"
            color="primary"
            @click="openExternal('https://dashboard.ngrok.com/get-started/your-authtoken')"
            append-icon="mdi-open-in-new"
        >トークンを取得</v-btn>
      </template>
    </v-text-field>
  </div>

  <v-overlay
      :model-value="registeringSSH"
      class="align-center justify-center"
      persistent
  >
    <v-progress-circular
        color="primary"
        size="200"
        indeterminate
    >
      <template v-slot:default>SSHキー登録中</template>
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
</template>

<style scoped>

</style>