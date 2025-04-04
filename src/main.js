
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'


import "@/assets/styles/main.less"
import "@/assets/styles/vars.less"

import * as components from './components'

const app = createApp(App)

for (const component in components) {
  app.component(component, components[component])
}

app.use(router)

app.mount('#app')
