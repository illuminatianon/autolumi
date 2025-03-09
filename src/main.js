/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App
 */

// Components
import App from './App.vue';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { registerPlugins } from '@/plugins';
import { useWebSocketStore } from './stores/websocket';

const app = createApp(App);
const pinia = createPinia();

pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// Register plugins
registerPlugins(app);

// Initialize WebSocket connection before mounting
const wsStore = useWebSocketStore();
await wsStore.connect();

app.mount('#app');
