import { defineStore } from 'pinia';
import { Octokit } from "@octokit/rest";
import axios from "axios";
import {IToken} from "../@types/global";

interface UserData {
    email: string | null,
    login: string,
    avatar_url: string
}

export const useGitHubStore = defineStore("github", {
    state: () => ({
        octokit: null,
        userData: null,
        accessToken: null,
        availableSSH: false,
        invitedRepositories: null,
        removeInvitations: [],
        gitVersion: null,
        fingerprint: null
    } as {
        octokit: Octokit | null,
        userData: UserData | null,
        accessToken: string | null,
        availableSSH: boolean,
        invitedRepositories: any,
        removeInvitations: Array<number>,
        gitVersion: string | null,
        fingerprint: string | null
    }),
    actions: {
        async logout(window: Window) {
            await window.token.logout()
            this.accessToken = null
            this.octokit = null
            this.userData = null
        },
        async login(window: Window) {
            window.shell.openExternal("https://github.com/login/oauth/authorize?client_id=fa8efab263c4358120b6&scope=read:user%20repo%20admin:public_key%20user:email%20delete_repo")
                .catch(error => {
                    console.log(error)
                })
            let response = await window.server.waitCallback("http://localhost:50000")

            if (response.error) return response.error

            try {
                response = await axios.post("https://shared-minecraft-server-api.yadokari1130-game.workers.dev", {code: response.code}, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                })
            }
            catch (e) {
                console.log(e)
                return "error"
            }

            if (response.data.error) return response.data.error
            if (!response.data.access_token) return "error"

            await window.token.setAccessToken(response.data.access_token)
            this.accessToken = response.data.access_token
            this.octokit = new Octokit({auth: this.accessToken})
            await this.fetchData(window)
        },
        async fetchData(window: Window) {
            if (this.octokit) {
                this.userData = (await this.octokit.rest.users.getAuthenticated()).data
                const emails = (await this.octokit.request('GET /user/emails', {
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                })).data

                this.userData.email = emails.filter(e => e.primary)[0].email

                this.invitedRepositories = (await this.octokit.rest.repos.listInvitationsForAuthenticatedUser()).data
                    .filter(i => !this.removeInvitations.includes(i.id))
            }
            
            const sshKeyPath = await window.file.getUserDataPath("ssh", "id_ed25519")
            let fp
            try {
                fp = window.command.execSync(`ssh-keygen -lf ${sshKeyPath}`)
            }
            catch (error) {
                this.availableSSH = false
                return
            }

            if (fp === this.fingerprint) return

            this.fingerprint = fp
            this.availableSSH = false
            window.command.exec(`ssh -i ${sshKeyPath} -T git@github.com -o IdentitiesOnly=true`,
                (error, stdout, stderr) => {
                    if (!error) return
                    console.log(error)
                    const result = /Hi (.+)! You've successfully authenticated, but GitHub does not provide shell access\./g.exec(stderr + "")
                    if (result && result[1] === this.userData?.login) this.availableSSH = true
                    else this.availableSSH = false
                })
        },
        async init(window: Window) {
            const accessToken = await window.token.getAccessToken()
            if (accessToken) this.octokit = new Octokit({auth: accessToken})
            else this.octokit = null
            try {
                this.gitVersion = window.command.execSync("git --version")
            }
            catch (error) {
                console.log(error)
                this.gitVersion = null
            }
        }
    }
});