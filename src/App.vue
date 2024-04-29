<script lang="ts">
import router from "./router";
import { useGitHubStore } from "./store/github";
import { defineComponent } from "vue";
import { useNgrokStore } from "./store/ngrok";
import { useRunningStore } from "./store/running";
import { useCloudflaredStore } from "./store/cloudflared";

export default defineComponent({
  data: () => ({
    githubStore: useGitHubStore(),
    ngrokStore: useNgrokStore(),
    runningStore: useRunningStore(),
    cloudflaredStore: useCloudflaredStore(),
    colors: {"起動中": "green", "終了中": "red", "停止済み": "grey", "エラー": "red"},
    dialog: false,
    startPath: null
  }),
  async mounted() {
    await this.ngrokStore.fetchData(window)
    await this.githubStore.init(window)
    await this.githubStore.fetchData(window)
    await this.cloudflaredStore.fetchData(window)

    this.startPath = await window.store.get("startPath")
    if (!this.startPath) {
      await router.push("/")
      this.dialog = true
    }

    await router.push(this.startPath)
  },
  async beforeCreate() {
    window.file.mkdir(await window.file.getUserDataPath("scripts"))
    window.file.mkdir(await window.file.getUserDataPath("temp"))
    if (window.shell.getPlatform() === "win32") {
      let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.bat")
      if (!window.file.exists(shPath)) window.file.save(shPath, "@echo off\nssh -T git@github.com")
    }
    else {
      let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.sh")
      if (!window.file.exists(shPath)) window.file.save(shPath, "#!/bin/bash\nssh -T git@github.com")
    }
  },
  methods: {
    async setStartPath() {
      await window.store.set("startPath", this.startPath)
      this.dialog = false
      await router.push(this.startPath)
    }
  }
})
</script>

<template>
  <v-app>
    <v-navigation-drawer
        expand-on-hover
        rail
        permanent
    >
      <v-list density="compact" nav>
        <v-list-item
            prepend-icon="mdi-home"
            title="ホーム"
            to="/"
            router/>
        <v-list-item
            title="Cloudflare Tunnel"
            to="/cloudflare-tunnel"
            router
            prepend-icon="mdi-lan-connect"
        />
        <v-list-item
            title="起動中のサーバー"
            to="/running"
            router>
          <template v-slot:prepend>
            <v-badge :model-value="this.runningStore.status !== 'エラー'" :color="colors[this.runningStore.status]" dot>
              <v-icon icon="mdi-console"></v-icon>
            </v-badge>
          </template>
        </v-list-item>
        <v-list-item
            prepend-icon="mdi-cog"
            title="基本設定"
            to="/settings"
            router/>
        <v-list-item
            title="招待されたサーバー"
            to="/invited"
            router
        >
          <template v-slot:prepend>
            <v-badge :content="githubStore.invitedRepositories?.length" color="red" :model-value="githubStore.invitedRepositories?.length > 0">
              <v-icon icon="mdi-account-multiple"></v-icon>
            </v-badge>
          </template>
        </v-list-item>
        <v-list-item
          title="アプリ情報"
          to="/appinfo"
          router
          prepend-icon="mdi-information-outline"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main class="ma-6 ml-16">
      <router-view/>
    </v-main>
  </v-app>

  <v-dialog
      v-model="dialog"
      width="1000px"
      transition="slide-y-transition"
      persistent
  >
    <v-card title="初期設定">
      <v-card-text>
        <p>起動時に開く画面を選択してください</p>
        <p>基本設定から変更することもできます</p>
        <v-radio-group class="mt-8" v-model="startPath">
          <v-radio label="サーバー一覧(主にサーバー管理を行う方向け)" value="/"/>
          <v-radio label="ポート開放不要機能(サーバー管理は行わず、主に他のサーバーに接続する方向け)" value="/cloudflare-tunnel"/>
        </v-radio-group>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            size="large"
            @click="setStartPath"
            :disabled="!startPath"
        >
          決定
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
</style>
