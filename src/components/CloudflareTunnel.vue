<script lang="ts">
import { defineComponent } from 'vue'
import { useCloudflaredStore } from "../store/cloudflared";

export default defineComponent({
  name: "Cloudflared",
  data: () => ({
    accessUrl: "",
    cloudflaredStore: useCloudflaredStore(),
    snackbarMessage: "",
    snackbar: false,
    errorSnackbar: false,
    errorMessage: "",
    overlay: false,
    overlayMessage: "",
  }),
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
    access() {
      this.setOverlay("接続中")

      try {
        this.cloudflaredStore.access(this.accessUrl, window)
        this.accessUrl = ""
      }
      catch (error) {
        console.log(error)
        this.setError("接続に失敗しました\nCloudflare Tunnelのアップデートを試してみてください")
        return
      }

      this.setSnackbar("接続しました\nMinecraft内で「localhost」と入力するとサーバーに接続することができます")
    },
    closeAccess() {
      this.setOverlay("切断中")

      try {
        this.cloudflaredStore.closeAccess(window)
      }
      catch (error) {
        console.log(error)
        this.setError("切断に失敗しました")
        return
      }

      this.setSnackbar("切断しました")
    },
    async save() {
      try {
        await this.cloudflaredStore.save(window)
      }
      catch (error) {
        console.log(error)
        this.setError("設定の保存に失敗しました")
      }
    },
    async updateCloudflared(install: boolean) {
      this.setOverlay(install ? "インストール中" : "アップデート中")
      try {
        await window.cloudflared.install()
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.cloudflaredStore.fetchData(window)
      }
      catch (error) {
        console.log(error)
        this.setError(`Cloudlfaredの${install ? "インストール" : "アップデート"}に失敗しました`)
        return
      }

      this.setSnackbar(`Cloudflaredを${install ? "インストール" : "アップデート"}しました`)
    },
  },
  async created() {
    await this.cloudflaredStore.fetchData(window)

    if (!this.cloudflaredStore.cloudflaredVersion) {
      this.cloudflaredStore.useCloudflared = false
      await this.save()
    }
  }
})
</script>

<template>
  <v-row>
    <v-col>
      <h1>Cloudflare Tunnel(ポート開放不要機能)</h1>
    </v-col>
  </v-row>

  <h2 class="ma-4">他のサーバーに接続</h2>
  <div class="border rounded pa-4">
    <v-row>
      <v-col cols="12">
        <v-text-field
            v-model="accessUrl"
            label="サーバーアドレス"
            variant="outlined"
            @keydown.enter="access"
            hide-details
        />
      </v-col>
      <v-col cols="12">
        <v-tooltip
          location="left"
          :disabled="!!cloudflaredStore.cloudflaredVersion"
          v-if="!cloudflaredStore.isAccessing"
        >
          <template v-slot:activator="{ props }">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  size="x-large"
                  color="primary"
                  elevation="8"
                  @click="access"
                  :disabled="!cloudflaredStore.cloudflaredVersion"
                  width="100%"
              >接続</v-btn>
            </div>
          </template>
          <p>Cloudflaredがインストールされていません</p>
          <p>基本設定画面からCloudflaredをインストールしてください</p>
        </v-tooltip>
        <v-btn
          size="x-large"
          color="error"
          elevation="8"
          @click="closeAccess"
          width="100%"
          v-else
        >切断する</v-btn>
      </v-col>
    </v-row>
  </div>

  <h2 class="ma-4 mt-16">
    Cloudflare Tunnel(ポート開放不要機能)
    <v-tooltip location="bottom">
      <template v-slot:activator="{props}">
        <v-icon v-bind="props" class="ml-4">mdi-help-circle-outline</v-icon>
      </template>
      <p>ポート開放をせずにサーバーを公開することができるアプリケーションです</p>
      <p>使うためにはサーバー参加者もEnderLinkをインストールし、接続を行う必要があります</p>
    </v-tooltip>
  </h2>
  <div class="border rounded pa-4">
    <v-checkbox
        hide-details
        label="Cloudflare Tunnel(ポート開放不要機能)を使う"
        @change="save"
        v-model="cloudflaredStore.useCloudflared"
        class="mb-4"
        :disabled="!cloudflaredStore.cloudflaredVersion"
    />
    <h3 class="mb-2">Cloudflare Tunnel：{{cloudflaredStore.cloudflaredVersion ? `インストール済み(${cloudflaredStore.cloudflaredVersion})` : "未インストール"}}</h3>
    <v-btn
        size="large"
        color="primary"
        @click="() => updateCloudflared(!cloudflaredStore.cloudflaredVersion)"
        width="100%"
        class="mb-4"
        style="text-transform: none"
    >Cloudflare Tunnelを{{ cloudflaredStore.cloudflaredVersion ? "アップデート" : "インストール" }}</v-btn>
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

<style scoped>

</style>