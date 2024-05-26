<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { useRunningStore } from "../store/running";
import { useRouter } from "vue-router";
import {IFile} from "../@types/global";
import { useServerSettingsStore } from "../store/server-settings";
import { useGitHubStore } from "../store/github";

export interface ServerData {
  name: string
  path: string
  args: string
  jarPath: string
  maxMem: number
  minMem: number
  url: string,
  repositoryId: number,
  owner: string,
}

export default defineComponent({
  name: "ServerCard",
  data: () => ({
    icon: null,
    runningStore: useRunningStore(),
    router: useRouter(),
    serverSettingsStore: useServerSettingsStore(),
    githubStore: useGitHubStore(),
    errorSnackbar: false,
    errorMessage: "",
  }),
  props: {
    serverData: Object as PropType<ServerData>
  },
  mounted() {
    if (window.file.exists(window.file.join(this.serverData.path, "server-icon.png")))
      this.icon = window.file.load(window.file.join(this.serverData.path, "server-icon.png"), "base64")
  },
  emits: ["setError", "setOverlay"],
  methods: {
    async run() {
      if (this.runningStore.isRunning) return

      if (!this.serverData.jarPath) {
        this.$emit("setError", "Jarファイルが設定されていません")
        return
      }

      this.$emit("setOverlay", "サーバー起動中")

      const result = await this.runningStore.run(this.serverData, this.icon, window)

      if (!result) {
        this.router.push("/running")
        return
      }

      if (result === "#downloadError") this.$emit("setError", "データの同期に失敗しました\n時間をあけてもう一度実行しても解決しない場合、強制ダウンロードを行ってください")
      else if (result === "#runningError") this.$emit("setError", "他のサーバーが起動中です")
      else if (result === "#githubError") this.$emit("setError", "GitHubのログインに失敗しました")
      else if (result === "#loadError") this.$emit("setError", "状態の読み込みに失敗しました")
      else if (result === "#saveError") this.$emit("setError", "状態の保存に失敗しました")
      else if (result === "#uploadError") this.$emit("setError", "状態の同期に失敗しました")
      else if (result === "#cloudflaredError") this.$emit("setError", "Cloudflaredの起動に失敗しました\nCloudflaredのアップデートを試してみてください")
      else this.$emit("setError", `${result}さんが起動中です`)
    },
  }
})
</script>

<template>
<v-card width="600px" elevation="4">
  <v-card-title>
    <div class="d-flex flex-row align-center">
      <v-img rounded inline :src="icon ? `data:image/png;base64,${icon}` : 'https://raw.githubusercontent.com/yadokari1130/EnderLink/master/public/pack.png'" width="128px" class="ma-2 mr-4"/>
      {{serverData.name}}
    </div>
  </v-card-title>
  <v-divider/>
  <v-card-actions>
    <v-row justify="space-evenly">
      <v-col cols="5">
        <v-tooltip :disabled="githubStore.userData && githubStore.availableSSH && !runningStore.isRunning" location="bottom">
          <template v-slot:activator="{props}">
            <div class="d-inline-block" v-bind="props" style="width: 100%">
              <v-btn
                  width="100%"
                  variant="elevated"
                  prepend-icon="mdi-play"
                  color="primary"
                  @click="run"
                  :disabled="!githubStore.userData || !githubStore.availableSSH || runningStore.isRunning"
                  size="large"
              >起動</v-btn>
            </div>
          </template>
          <div v-if="runningStore.isRunning">
            <p>他のサーバーが起動中です</p>
            <p>複数のサーバーを同時に起動させることはできません</p>
          </div>
          <div v-else>
            <p>起動できません</p>
            <p>ネットワーク接続を確認してください</p>
          </div>
        </v-tooltip>
      </v-col>
      <v-col cols="5">
        <v-btn
            width="100%"
            variant="elevated"
            prepend-icon="mdi-cog"
            color="primary"
            @click="() => {
              this.serverSettingsStore.serverData = this.serverData
              this.router.push('server-settings')
            }"
            :disabled="!githubStore.userData || !githubStore.availableSSH"
            size="large"
        >設定</v-btn>
      </v-col>
    </v-row>
  </v-card-actions>
</v-card>
</template>

<style scoped>

</style>