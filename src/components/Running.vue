<script lang="ts">
import { defineComponent } from 'vue'
import { useRunningStore } from "../store/running";
import {ICommand} from "../@types/global";
import ServerProperties from "../datas/serverProperties";
import axios from "axios";

interface ServerData {
  name: string
  path: string
  commandPath?: string
  command?: string
}

export default defineComponent({
  name: "Running",
  data: () => ({
    runningStore: useRunningStore(),
    command: "",
    errorSnackbar: false,
    errorMessage: "",
    snackbar: false,
    snackbarMessage: "",
    port: "",
    ip: "",
    killDialog: false
  }),
  methods: {
    setError(errorMessage: string) {
      this.errorMessage = `エラーが発生しました${errorMessage ? "\n" + errorMessage : ""}`
      this.errorSnackbar = true
    },
    sendCommand() {
      try {
        window.command.write(this.command)
      }
      catch (error) {
        console.log(error)
        this.setError("コマンドの実行に失敗しました")
        return
      }
      this.runningStore.add("> " + this.command + "\n")
      this.command = ""
    },
    kill() {
      window.command.kill()
    },
    copy() {
      navigator.clipboard.writeText(this.runningStore.url || `${this.ip}:${this.port}`)
          .then(() => this.setSnackbar("コピーしました"))
          .catch(error => {
            console.log(error)
            this.setError("コピーに失敗しました")
          })
    },
    setSnackbar(message: string) {
      this.snackbarMessage = message
      this.snackbar = true
    },
    tweet() {
      let ipTweet = `${this.ip}:${this.port}`
      let cfTweet = `${this.runningStore.url}\nEnderLinkをインストールし、以下を参考に接続してください\nhttps://github.com/yadokari1130/EnderLink/blob/master/CONNECT_CLOUDFLARE_TUNNEL`
      let params = {
        url: "https://github.com/yadokari1130/EnderLink/releases/latest/",
        text: `Minecraftサーバーを公開しました！\nこのアドレスから参加：${this.runningStore.url ? cfTweet : ipTweet}`,
        hashtags: "Minecraft,EnderLink"
      }
      window.shell.openExternal(`https://twitter.com/share?${Object.entries(params).reduce((acc, cur) => [`${acc[0]}${cur[0]}=${encodeURIComponent(cur[1])}&`, ""], ["", ""])}`)
    }
  },
  mounted() {
    if (this.runningStore.serverData) {
      let props = new ServerProperties(window.file.join(this.runningStore.serverData.path, "server.properties"), window)
      this.port = props.props["server-port"].value
      axios.get("https://api.ipify.org/?format=json")
          .then(res => {
            this.ip = res.data.ip
          })
    }
  },
  watch: {
    "runningStore.log": function() {
      if (this.runningStore.log.endsWith("Press any key to continue . . . ")) {
        this.command = "quit"
        this.sendCommand()
      }
    }
  }
})
</script>

<template>
  <div v-if="runningStore.serverData">
    <v-row class="d-flex flex-row align-center ma-4 ml-0">
      <v-img rounded inline :src="runningStore.icon ? `data:image/png;base64,${runningStore.icon}` : 'https://raw.githubusercontent.com/yadokari1130/EnderLink/master/public/pack.png'" width="64px" class="mr-4 ml-0"/>
      <h1>{{runningStore.serverData.name}}</h1>
    </v-row>

    <h2 class="mt-6">状態：{{runningStore.status}}</h2>
    <div class="d-flex flex-row align-center">
      <h2 v-if="runningStore.url">サーバーアドレス：{{runningStore.url}}</h2>
      <h2 v-else>サーバーアドレス：{{ip}}:{{port}}</h2>
      <v-btn icon="mdi-content-copy" variant="text" @click="copy"></v-btn>
      <v-btn @click="tweet" size="large" color="primary" class="ml-6">ツイートする</v-btn>
    </div>

    <h2 class="mt-6 ma-1">サーバーログ</h2>
    <v-textarea
        readonly
        variant="outlined"
        rows="15"
        v-model="runningStore.log"
    />
    <v-text-field
        v-model="command"
        density="comfortable"
        variant="outlined"
        @keydown.enter="sendCommand"
        :disabled="!runningStore.isRunning"
        placeholder="コマンドを入力 例：stop"
    />

    <v-tooltip location="bottom">
      <template v-slot:activator="{props}">
        <v-btn
            width="100%"
            size="large"
            color="error"
            variant="outlined"
            prepend-icon="mdi-stop"
            class="mt-16"
            v-bind="props"
            :disabled="!runningStore.isRunning"
            @click="killDialog = true"
        >強制終了</v-btn>
      </template>
      <p>正常にデータが保存されない場合があるため、通常は「stop」コマンドで終了させてください</p>
    </v-tooltip>
  </div>
  <h1 v-else>起動中のサーバーなし</h1>

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

  <v-dialog
      v-model="killDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="強制終了">
      <v-card-text>
        <p>本当に強制終了しますか？</p>
        <p><strong>強制終了した場合、正常にサーバーデータが保存されない可能性があります</strong></p>
        <p><strong>通常はstopコマンドで終了し、しばらく待っても終了しない場合のみ強制終了を行ってください</strong></p>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="killDialog = false"
            size="large"
        >閉じる</v-btn>
        <v-btn
            variant="text"
            @click="kill"
            size="large"
            color="red"
        >削除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>