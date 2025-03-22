<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <RouterLink to="/" class="logo"><img src="/favicon.png" alt="logo">Ultimate Lego Plotter</RouterLink>
  </header>
  <RouterView />
  <footer>
    <nav class="inner">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <div class="copyrights">
        <p>
          &copy; 2025 <a href="https://github.com/AnToHu0">Arpeggi0</a>
        </p>
      </div>
    </nav>
  </footer>
</template>

<style lang="less">
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.5rem;
    font-weight: bold;
    img {
      max-width: 50px
    }
  }
  .copyrights {
    margin-left: auto;
  }
</style>
