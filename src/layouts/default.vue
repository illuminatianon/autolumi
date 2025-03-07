<template>
  <v-layout>
    <v-app>
      <v-navigation-drawer
        v-model="drawer"
        location="left"
        permanent
        width="400"
      >
        <v-list>
          <v-list-item>
            <v-list-item-title class="text-h6">
              Generation Configs
            </v-list-item-title>
          </v-list-item>
        </v-list>
        <slot name="sidebar" />
      </v-navigation-drawer>

      <v-main>
        <v-container fluid>
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </v-container>
      </v-main>

      <v-footer app>
        <span>&copy; {{ new Date().getFullYear() }}</span>
      </v-footer>
    </v-app>
  </v-layout>
</template>

<script setup>
import { ref } from 'vue';

const drawer = ref(true);
</script>

<style scoped>
.v-navigation-drawer {
  padding: 12px;
}
</style>
