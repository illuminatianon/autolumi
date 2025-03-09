/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App
 */

// Components
import App from './App.vue';

// Composables
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

// Plugins
import { registerPlugins } from '@/plugins';
import { useWebSocketStore } from './stores/websocket';

const app = createApp(App);
const pinia = createPinia();

pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// Register plugins
registerPlugins(app);

// Initialize WebSocket store
const wsStore = useWebSocketStore();
wsStore.connect();

app.mount('#app');
