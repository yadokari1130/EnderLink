<script lang="ts">
import { defineComponent } from 'vue'
import {IFile} from "../@types/global";
import { useServerSettingsStore } from "../store/server-settings";
import { useGitHubStore } from "../store/github";
import WorldCard from "./WorldCard.vue";
import ServerProperties from "../datas/serverProperties";
import DataPackCard from "./DataPackCard.vue";
import StreamZip from "node-stream-zip";

export default defineComponent({
  name: "WorldSettings",
  components: {DataPackCard, WorldCard},
  data: () => ({
    worldPath: "",
    serverSettingsStore: useServerSettingsStore(),
    githubStore: useGitHubStore(),
    singleWorlds: [],
    singleWorldDialog: false,
    selectedWorldPath: null,
    props: null,
    deleteDataPacks: [],
    addDataPacks: [],
    datapacks: [],
    changeWorldMode: null,
  }),
  emits: ["setError", "setOverlay", "setSnackbar", "setCommitLog"],
  methods: {
    async selectSingleWorld() {
      this.selectedWorldPath = null
      let savesPath = window.file.getMinecraftPath("saves")
      let singleFiles = window.file.getAllChildren(savesPath)
      this.singleWorlds = singleFiles.map(s => window.file.join(savesPath, s))

      this.singleWorldDialog = true
    },
    async selectFile() {
      this.selectedWorldPath = null
      let selected = await window.file.selectPath()
      if (selected) {
        if (!window.file.exists(window.file.join(selected[0], "level.dat"))) {
          this.$emit("setError", "ワールドフォルダではありません")
          return
        }
        this.selectedWorldPath = selected[0]
      }
    },
    async selectDataPackZip() {
      let selected = await window.file.selectFilePath("")
      if (selected) {
        if (this.addDataPacks.includes(selected[0])) {
          this.$emit("setError", "選択済みです")
          return
        }
        window.file.stream(selected[0], (zip: StreamZip) => {
          if (zip.entries()["pack.mcmeta"]) this.addDataPacks.push(selected[0])
          else this.$emit("setError", "データパックではありません")

          zip.close()
        })
      }
    },
    async selectDataPack() {
      this.selected = null
      let selected = await window.file.selectPath()
      if (selected) {
        if (!window.file.exists(window.file.join(selected[0], "pack.mcmeta"))) {
          this.$emit("setError", "ワールドフォルダではありません")
          return
        }
        if (this.addDataPacks.includes(selected[0])) {
          this.$emit("setError", "選択済みです")
          return
        }

        this.addDataPacks.push(selected[0])
      }
    },
    async applyDataPack() {
      this.$emit("setOverlay", "適用中")

      let dest = window.file.join(this.serverSettingsStore.serverData.path, this.props.props["level-name"].value, "datapacks")

      try {
        for (let dp of this.addDataPacks) {
          if (this.deleteDataPacks.includes(dp)) {
            this.deleteDataPacks = this.deleteDataPacks.filter((d: string) => d !== dp)
            continue
          }

          let basename = window.file.basename(dp)

          window.file.cp(dp, window.file.join(dest, basename), () => true)
        }
      }
      catch(error) {
        console.log(error)
        this.$emit("setError", "データパックの適用に失敗しました")
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "データパックの更新")
        this.$emit("setCommitLog")
      }
      catch(error) {
        console.log(error)
        this.$emit("setError", "データの更新に失敗しました")
      }

      this.deleteDataPacks.forEach((dp: string) => window.file.rm(dp))

      this.addDataPacks = []
      this.deleteDataPacks = []
      this.datapacks = []

      let dps = window.file.getAllChildren(dest)
      this.datapacks = dps.map(dp => window.file.join(dest, dp))

      this.$emit("setSnackbar", "データパックを更新しました")
    },
    async changeWorld() {
      this.$emit("setOverlay", "変更中")

      let dest = window.file.join(this.serverSettingsStore.serverData.path, this.props.props["level-name"].value)

      try {
        window.file.mkdir(window.file.join(dest, "datapacks"))
        if ((this.changeWorldMode & 2) === 2)
          window.file.cp(window.file.join(dest, "datapacks"), await window.file.getUserDataPath("temp", "datapacks"), () => true)
        window.file.rm(dest)
        window.file.cp(this.selectedWorldPath, dest, (src) => (this.changeWorldMode & 1) === 1 || window.file.basename(src) !== "datapacks")
        window.file.mkdir(window.file.join(dest, "datapacks"))
        if ((this.changeWorldMode & 2) === 2) {
          let tempDPs = await window.file.getUserDataPath("temp", "datapacks")
          for (let dp of window.file.getAllChildren(tempDPs)) {
            window.file.mv(window.file.join(tempDPs, dp), window.file.join(dest, "datapacks", dp))
          }
          window.file.rm(tempDPs);
        }
      }
      catch(error) {
        console.log(error)
        this.$emit("setError", "ワールドの変更に失敗しました")
        return
      }

      try {
        await window.git.upload(this.serverSettingsStore.serverData.path, "ワールド変更")
        this.$emit("setCommitLog")
      }
      catch(error) {
        console.log(error)
        this.$emit("setError", "データの同期に失敗しました")
        return
      }

      this.selectedWorldPath = null
      this.$emit("setSnackbar", "ワールドを変更しました")
    },
  },
  mounted() {
    this.props = new ServerProperties(window.file.join(this.serverSettingsStore.serverData.path, "server.properties"), window)
    let dpPath = window.file.join(this.serverSettingsStore.serverData.path, this.props.props["level-name"].value, "datapacks")

    window.file.mkdir(dpPath)

    let dps = window.file.getAllChildren(dpPath)
    this.datapacks = dps.map(dp => window.file.join(dpPath, dp))
  }
})
</script>

<template>
  <h2 class="ma-4">ワールド</h2>
  <div class="rounded border pa-4">
    <v-row>
      <v-col cols="6">
        <v-btn
            color="primary"
            size="large"
            width="100%"
            @click="selectSingleWorld"
        >シングルワールドを選択</v-btn>
      </v-col>
      <v-col cols="6">
        <v-tooltip location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
                color="primary"
                size="large"
                width="100%"
                @click="selectFile"
                v-bind="props"
            >フォルダを選択</v-btn>
          </template>
          配布ワールドなどは解答したものを選択してください
        </v-tooltip>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="6" v-if="selectedWorldPath">
        <world-card
            :path="selectedWorldPath"
            width="100%"/>
      </v-col>
      <v-col cols="6" v-else align-self="center">
        <p class="text-center">ワールドを選択してください</p>
      </v-col>
      <v-col cols="6" align-self="center">
        <v-radio-group v-model="changeWorldMode" hide-details :disabled="!selectedWorldPath">
          <v-radio label="データパックをすべて削除" :value="0"/>
          <v-radio label="元々入っていたデータパックを保持" :value="1"/>
          <v-radio label="選択したワールドのデータパックと入れ替え" :value="2"/>
          <v-radio label="元々のデータパックに選択したワールドのデータパックを追加" :value="3"/>
        </v-radio-group>
      </v-col>

      <v-col cols="12">
        <v-btn
            color="primary"
            size="large"
            width="100%"
            :disabled="changeWorldMode === null"
            @click="changeWorld"
        >ワールドを変更</v-btn>
      </v-col>
    </v-row>
  </div>

  <h2 class="ma-4 mt-16">データパック</h2>
  <div class="rounded border pa-4">
    <v-row>
      <v-col cols="6">
        <v-btn
            color="primary"
            size="large"
            width="100%"
            @click="selectDataPackZip"
        >zip形式のデータパックを選択</v-btn>
      </v-col>
      <v-col cols="6">
        <v-btn
            color="primary"
            size="large"
            width="100%"
            @click="selectDataPack"
        >フォルダ形式のデータパックを選択</v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-btn
          color="primary"
          size="large"
          width="100%"
          @click="applyDataPack"
          :disabled="addDataPacks.length === 0 && deleteDataPacks.length === 0"
        >データパックを適用</v-btn>
      </v-col>
    </v-row>

    <h3 class="mt-6 mb-2">導入中のデータパック</h3>
    <v-row v-if="datapacks.length === 0">
      <v-col cols="12">
        <h2>データパックなし</h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" v-for="dp in datapacks">
        <data-pack-card
            :path="dp"
            width="100%"
            :isDelete="deleteDataPacks.includes(dp)"
            :isAdd="false"
            @deleteDataPack="deleteDataPacks.push(dp)"
            @deleteCancel="deleteDataPacks = deleteDataPacks.filter(d => d !== dp)"
        />
      </v-col>
      <v-col cols="12" v-for="dp in addDataPacks">
        <data-pack-card
            :path="dp"
            width="100%"
            :isDelete="deleteDataPacks.includes(dp)"
            :isAdd="true"
            @deleteDataPack="deleteDataPacks.push(dp)"
            @deleteCancel="deleteDataPacks = deleteDataPacks.filter(d => d !== dp)"
        />
      </v-col>
    </v-row>
  </div>

  <v-dialog
      v-model="singleWorldDialog"
      width="800px"
      transition="slide-y-transition"
  >
    <v-card title="シングルワールドを選択">
      <v-card-text>
        <v-row justify="center">
          <world-card
              class="my-4"
              v-for="s in singleWorlds"
              :path="s"
              hover
              width="600px"
              @click="() => {
                this.selectedWorldPath = s
                this.singleWorldDialog = false
              }"/>
        </v-row>
      </v-card-text>
      <v-divider/>
      <v-card-actions>
        <v-spacer/>
        <v-btn
            variant="text"
            @click="singleWorldDialog = false"
            size="large"
        >閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>