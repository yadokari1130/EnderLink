<script lang="ts">
import { defineComponent } from 'vue'
import StreamZip from "node-stream-zip";

export default defineComponent({
  name: "DataPackCard",
  emits: ["deleteDataPack", "deleteCancel"],
  data: () => ({
    dataPackName: "",
    icon: "",
    description: ""
  }),
  props: {
    path: String,
    width: String,
    isDelete: Boolean,
    isAdd: Boolean
  },
  async mounted() {
    this.dataPackName = window.file.basename(this.path)
    if (this.dataPackName.endsWith(".zip")) {
      window.file.stream(this.path, (zip: StreamZip) => {
        this.description = JSON.parse(new TextDecoder().decode(zip.entryDataSync("pack.mcmeta"))).pack.description
        if (zip.entries()["pack.png"]) this.icon = btoa(String.fromCharCode(...zip.entryDataSync("pack.png")))

        zip.close()
      })
    }
    else {
      if (window.file.exists(window.file.join(this.path, "pack.png")))
        this.icon = window.file.load(window.file.join(this.path, "pack.png"), "base64")
      this.description = JSON.parse(window.file.load(window.file.join(this.path, "pack.mcmeta"), "utf-8")).pack.description
    }
  },
  methods: {
  }
})
</script>

<template>
  <v-card :width="width" variant="outlined" :color="isDelete ? 'red' : isAdd ? 'primary' : 'black'">
    <v-card-title>
      <div class="d-flex flex-row align-center">
        <v-img rounded inline :src="icon ? `data:image/png;base64,${icon}` : 'https://raw.githubusercontent.com/yadokari1130/EnderLink/master/public/pack.png'" width="64px" class="ma-2 mr-4"/>
        <div>
          <p>{{dataPackName}}</p>
          <p class="text-caption">{{ description }}</p>
        </div>
        <v-spacer/>
        <v-btn
          icon="mdi-delete-outline"
          size="x-large"
          variant="text"
          @click="$emit('deleteDataPack')"
          v-if="!isDelete"
        />
        <v-btn
            icon="mdi-arrow-u-left-top"
            size="x-large"
            variant="text"
            @click="$emit('deleteCancel')"
            v-else
        />
      </div>
    </v-card-title>
  </v-card>
</template>

<style scoped>

</style>