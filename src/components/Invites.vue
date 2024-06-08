<script lang="ts">
import { defineComponent } from 'vue'
import { useGitHubStore } from "../store/github";

export default defineComponent({
  name: "Invites",
  data: () => ({
    repositories: [],
    githubStore: useGitHubStore(),
    snackbar: false,
    snackbarMessage: "",
    snackbarColor: undefined
  }),
  async created() {
    await this.githubStore.fetchData(window)
  },
  methods: {
    async accept(invitationId: number) {
      try {
        await this.githubStore.octokit.rest.repos.acceptInvitationForAuthenticatedUser({invitation_id: invitationId})
      }
      catch (error) {
        console.log(error)
        this.snackbarMessage = "エラーが発生しました"
        this.snackbarColor = "error"
        this.snackbar = true
      }

      this.githubStore.removeInvitations.push(invitationId)

      this.snackbarMessage = "招待を受け入れました\nホーム画面からサーバーを追加してください\nサーバー一覧に表示されるまでには時間がかかる可能性があります"
      this.snackbarColor = undefined
      this.snackbar = true

      await this.githubStore.fetchData(window)
    },
    async decline(invitationId: number) {
      try {
        await this.githubStore.octokit.rest.repos.declineInvitationForAuthenticatedUser({invitation_id: invitationId})
      }
      catch (error) {
        console.log(error)
        this.snackbarMessage = "エラーが発生しました"
        this.snackbarColor = "error"
        this.snackbar = true
      }

      this.githubStore.removeInvitations.push(invitationId)

      this.snackbarMessage = "招待を拒否しました"
      this.snackbarColor = undefined
      this.snackbar = true

      await this.githubStore.fetchData(window)
    }
  }
})
</script>

<template>
  <v-row class="mb-6">
    <v-col>
      <h1>招待されたサーバー</h1>
    </v-col>
  </v-row>

  <v-row>
    <v-col>
      <v-data-table
          :items="githubStore.invitedRepositories ? githubStore.invitedRepositories.map(invited => ({
              name: invited.repository.name,
              owner: invited.repository.owner.login,
              inviter: invited.inviter.login,
              date: new Date(invited.created_at).toLocaleDateString('ja-JP'),
              invitationId: invited.id
          })) : []"
          :headers="[
              {title: 'サーバー名', key: 'name'},
              {title: '所有者', key: 'owner'},
              {title: '招待者', key: 'inviter'},
              {title: '招待日', key: 'date'},
              {title: '操作', key: 'actions', align: 'center', sortable: false},
          ]"
          :items-per-page="100"
      >
        <template v-slot:item.actions="{item}">
          <v-btn
              icon="mdi-check"
              color="success"
              variant="text"
              @click="accept(item.invitationId)"
          />
          <v-btn
              icon="mdi-close"
              color="error"
              variant="text"
              @click="decline(item.invitationId)"
          />
        </template>
        <template v-slot:bottom></template>
      </v-data-table>
    </v-col>
  </v-row>

  <v-snackbar
      v-model="snackbar"
      timeout="4000"
      multi-line
      :color="snackbarColor"
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