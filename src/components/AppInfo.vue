<script lang="ts">
import { defineComponent } from 'vue'
import {version} from "../../package.json"
import {IShell} from "../@types/global";

export default defineComponent({
  name: "AppInfo",
  computed: {
    version() {
      return version
    }
  },
  methods: {
    openExternal(url: string) {
      window.shell.openExternal(url)
    }
  }
})
</script>

<template>
  <h1 class="ma-4">EnderLink {{version}}</h1>

  <h2 class="mt-16 ma-4">リンク</h2>
  <div class="border rounded pa-4">
    <h3 @click="openExternal('https://github.com/yadokari1130/EnderLink/blob/master/README.md')" class="link">
      使い方
      <v-icon>mdi-open-in-new</v-icon>
    </h3>
  </div>

  <h2 class="mt-16 ma-4">コンタクト</h2>
  <div class="border rounded pa-4">
    <h3 @click="openExternal('https://twitter.com/Y4D0K4R1')" class="link">
      Twitter: Y4D0K4R1
      <v-icon>mdi-open-in-new</v-icon>
    </h3>
    <h3 @click="openExternal('https://github.com/yadokari1130/EnderLink/issues')" class="link">
      GitHub Issue
      <v-icon>mdi-open-in-new</v-icon>
    </h3>
  </div>

  <h2 class="mt-16 ma-4">その他サービス</h2>
  <div class="border rounded pa-4">
    <h3 @click="openExternal('https://github.com/yadokari1130/Loglin/blob/master/README.md')" class="link">
      Loglin
      <v-icon>mdi-open-in-new</v-icon>
    </h3>
    <p
        class="text-medium-emphasis"
        v-text="'Minecraft内チャットとDiscordを繋げるアプリです\nDiscord内からMinecraftのコマンドを実行したり、サーバーの操作を行うことができます'"
        style="white-space: pre-wrap"
    />
  </div>
</template>

<style scoped>
.link {
  cursor: pointer;
  color: blue;
  width: fit-content;
}
</style>