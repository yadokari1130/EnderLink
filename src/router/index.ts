import { createWebHistory, createRouter, RouteLocationNormalized } from "vue-router";
import Home from "../components/Home.vue";
import Settings from "../components/Settings.vue"
import Running from "../components/Running.vue"
import ServerSettings from "../components/ServerSettings.vue"
import Invited from "../components/Invites.vue"
import AppInfo from "../components/AppInfo.vue";

const routes = [
    {
        path: "/",
        name: "Home",
        component: Home,
    },
    {
        path: "/settings",
        name: "Settings",
        component: Settings
    },
    {
        path: "/running",
        name: "Running",
        component: Running
    },
    {
        path: "/server-settings",
        name: "ServerSettings",
        component: ServerSettings
    },
    {
        path: "/invited",
        name: "InvitedServer",
        component: Invited
    },
    {
        path: "/appinfo",
        name: "AppInfo",
        component: AppInfo
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;