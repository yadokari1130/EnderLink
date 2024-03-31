<script lang="ts">
import router from "./router";
import { useGitHubStore } from "./store/github";
import { defineComponent } from "vue";
import { useNgrokStore } from "./store/ngrok";
import { useRunningStore } from "./store/running";

export default defineComponent({
  data: () => ({
    githubStore: useGitHubStore(),
    ngrokStore: useNgrokStore(),
    runningStore: useRunningStore(),
    colors: {"起動中": "green", "終了中": "red", "停止済み": "grey", "エラー": "red"}
  }),
  async mounted() {
    await this.ngrokStore.fetchData(window)
    await this.githubStore.init(window)
    await this.githubStore.fetchData(window)

    await router.push("/")
  },
  async beforeCreate() {
    window.file.mkdir(await window.file.getUserDataPath("scripts"))
    if (window.shell.getPlatform() === "win32") {
      let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.bat")
      if (!window.file.exists(shPath)) await window.file.save(shPath, "@echo off\nssh -T git@github.com")
    }
    else {
      let shPath = await window.file.getUserDataPath("scripts", "hostbasedAuth.sh")
      if (!window.file.exists(shPath)) await window.file.save(shPath, "#!/bin/bash\nssh -T git@github.com")
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
</template>

<style scoped>
</style>
