<script setup>
defineProps({
  images: {
    type: Array,
    required: true,
  },
});

defineEmits(['image-click']);
</script>

<template>
  <v-card>
    <v-card-title>Generated Images</v-card-title>
    <v-card-text>
      <v-row>
        <v-col
          v-for="image in images"
          :key="image.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-img
            :src="image.path"
            aspect-ratio="1"
            cover
            class="rounded-lg"
            @click="$emit('image-click', image)"
          >
            <template #placeholder>
              <v-row
                class="fill-height ma-0"
                align="center"
                justify="center"
              >
                <v-progress-circular
                  indeterminate
                  color="primary"
                />
              </v-row>
            </template>
          </v-img>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
