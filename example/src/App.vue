<template>
  <h1><img alt="Quill Logo" width="180" src="./assets/logo.svg" /></h1>
  <Editor />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Editor from './components/TestEditor.vue'

export default defineComponent({
  name: 'App',
  components: {
    Editor
  }
})
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 60px auto 0;
  max-width: 960px;
}
h1 {
  text-align: center;
}
</style>
