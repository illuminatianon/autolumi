/**
 * plugins/vuetify.js
 */
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export default createVuetify({
  defaults: {
    VTooltip: {
      transition: 'fade-transition',
    },
  },
  theme: {
    defaultTheme: 'dark',
  },
});
