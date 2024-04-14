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
    ip: ""
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
      <h2 v-if="runningStore.url">URL：{{runningStore.url}}</h2>
      <h2 v-else>URL：{{ip}}:{{port}}</h2>
      <v-btn icon="mdi-content-copy" variant="text" @click="copy"></v-btn>
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
        prepend-icon="mdi-play"
        variant="outlined"
        @keydown.enter="sendCommand"
        @click:prepend="sendCommand"
        :disabled="!runningStore.isRunning"
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
            @click="kill"
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
</template>

<style scoped>

</style>