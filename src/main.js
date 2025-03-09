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

// Plugins
import { registerPlugins } from '@/plugins';
import { useWebSocketStore } from './stores/websocket';
import { useGenerationStore } from './stores/generation';

const app = createApp(App);

// Register plugins first (this includes Vuetify)
registerPlugins(app);

// Then initialize Pinia stores
const pinia = createPinia();
app.use(pinia);

// Initialize WebSocket connection and stores
const wsStore = useWebSocketStore();
const generationStore = useGenerationStore();

wsStore.connect();
generationStore.init(); // Set up WebSocket message handlers

// Mount the app last
app.mount('#app');
