/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins';

// Components
import App from './App.vue';

// Composables
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { useWebSocketStore } from './stores/websocket';
import { useGenerationStore } from './stores/generation';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Initialize WebSocket connection and stores
const wsStore = useWebSocketStore();
const generationStore = useGenerationStore();

wsStore.connect();
generationStore.init(); // Set up WebSocket message handlers

app.mount('#app');
