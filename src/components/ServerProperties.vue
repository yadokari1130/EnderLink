<script lang="ts">
import { defineComponent } from 'vue'
import ServerProperties from "../datas/serverProperties";
import { useServerSettingsStore } from "../store/server-settings";
import { useRunningStore } from "../store/running";
import { useGitHubStore } from "../store/github";

export default defineComponent({
  name: "ServerProperties",
  props: {
    serverProps: ServerProperties | null
  },
  data: (): {
    serverSettingsStore: any,
    search: string,
    runningStore: any,
    githubStore: any,
  } => ({
    serverSettingsStore: useServerSettingsStore(),
    search: "",
    runningStore: useRunningStore(),
    githubStore: useGitHubStore(),
  }),
  emits: ["setError", "setOverlay", "setSnackbar"],
  methods: {
    async save() {
      this.$emit("setOverlay", "保存中")

      try {
        await window.git.download(this.serverSettingsStore.serverData.path)
      }
      catch (error) {
        console.log(error)
        this.$emit("setError", "データの同期に失敗しました")
        return
      }

      try {
        this.serverProps.save(window)
      }
      catch (error) {
        console.log(error)
        this.$emit("setError", "データの保存に失敗しました")
        return
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "server.propertiesの変更")
      }
      catch (error) {
        console.log(error)
        this.$emit("setError", "データのアップロードに失敗しました")
        return
      }

      this.$emit("setSnackbar", "保存しました")
    }
  }
})
</script>

<template>
  <v-text-field
      label="プロパティ名"
      prepend-icon="mdi-magnify"
      v-model="search"
      variant="outlined"
      class="my-2"
  />
  <div class="my-8" ref="properties">
    <div class="mb-8" v-if="serverProps" v-for="[key, value] of Object.entries(this.serverProps.props).sort((a, b) => a[0].localeCompare(b[0]))">
      <div  v-if="search === '' || key.includes(search)">
        <v-row align="center">
          <v-col cols="3"><h4>{{key}}</h4></v-col>
          <v-col cols="9">
            <v-text-field
                v-if="value.type === String && !value.selection"
                hide-details
                variant="outlined"
                v-model="value.value"/>
            <v-select
                v-if="value.type === String && value.selection"
                hide-details
                variant="outlined"
                :items="value.selection"
                v-model="value.value"/>
            <v-text-field
                v-if="value.type === Number"
                hide-details
                variant="outlined"
                type="number"
                v-model="value.value"
                @change="() => {
                if (value.limit) {
                  value.value = Math.max(value.value, value.limit[0])
                  value.value = Math.min(value.value, value.limit[1])
                }
              }"/>
            <v-checkbox
                v-if="value.type === Boolean"
                hide-details
                v-model="value.value"/>
          </v-col>
        </v-row>
        <p class="text-medium-emphasis" v-text="value.description" style="white-space: pre-wrap"/>
      </div>
    </div>

    <v-layout-item model-value position="bottom" size="80" :style="`width: ${this.$refs?.properties?.clientWidth || 100}px; background-color: white`" class="ml-16 mr-6">
      <v-tooltip location="top" :disabled="!runningStore.isRunning">
        <template v-slot:activator="{props}">
          <div class="d-inline-block" style="width: 100%;" v-bind="props">
            <v-btn
                @click="save"
                color="primary"
                size="large"
                width="100%"
                :disabled="runningStore.isRunning"
            >保存</v-btn>
          </div>
        </template>
        <p>起動中のサーバーを停止してください</p>
      </v-tooltip>
    </v-layout-item>
  </div>
</template>

<style scoped>

</style>