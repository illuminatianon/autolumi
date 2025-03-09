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
import { useGenerationStore } from './stores/generation';

const app = createApp(App);

// Register plugins (Vuetify, Router)
registerPlugins(app);

// Initialize Pinia with plugins
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// Initialize WebSocket connection and stores
const wsStore = useWebSocketStore();
const generationStore = useGenerationStore();

app.mount('#app');
