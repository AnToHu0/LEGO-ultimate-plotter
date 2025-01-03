<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
      <RouterLink to="/" class="logo">Plotter-time!</RouterLink>
  </header>
  <RouterView />
  <footer>
    <nav class="inner">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
    </nav>
  </footer>
</template>

<style lang="less">

</style>
