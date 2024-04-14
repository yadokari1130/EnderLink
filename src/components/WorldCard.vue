<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: "WorldCard",
  data: () => ({
    levelName: "",
    version: "",
    icon: "",
  }),
  props: {
    path: String,
    width: String,
    hover: Boolean
  },
  async mounted() {
    let raw = window.file.loadBuffer(window.file.join(this.path, "level.dat"))
    const {parsed} = await window.nbt.parse(raw, "big")
    this.version = parsed.value.Data.value.Version.value.Name.value
    this.levelName = parsed.value.Data.value.LevelName.value

    if (window.file.exists(window.file.join(this.path, "icon.png")))
      this.icon = window.file.load(window.file.join(this.path, "icon.png"), "base64")
  },
  methods: {
  }
})
</script>

<template>
  <v-card :width="width" variant="outlined" :hover="hover">
    <v-card-title>
      <div class="d-flex flex-row align-center">
        <v-img rounded inline :src="icon ? `data:image/png;base64,${icon}` : 'https://raw.githubusercontent.com/yadokari1130/EnderLink/master/public/pack.png'" width="64px" class="ma-2 mr-4"/>
        {{levelName}}
      </div>
    </v-card-title>
    <v-card-text>
      <p>バージョン: {{version}}</p>
      <p>フォルダパス: {{path}}</p>
    </v-card-text>
  </v-card>
</template>

<style scoped>

</style>