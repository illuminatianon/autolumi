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
const pinia = createPinia();

// Register plugins first
registerPlugins(app);

// Then initialize Pinia
app.use(pinia);

// Initialize stores after Pinia is installed
const wsStore = useWebSocketStore();
const generationStore = useGenerationStore();

// Mount the app
app.mount('#app');
