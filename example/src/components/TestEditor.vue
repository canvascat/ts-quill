<template>
  <div class="quill-editor">
    <slot name="toolbar"></slot>
    <div ref="editor"></div>
  </div>
</template>

<script lang="ts">
import { ref, defineComponent, onMounted } from 'vue'
import Quill from '../../../src/index'
import '../../../src/assets/snow.styl'


const toolbar = [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image', 'video']
    ]

export default defineComponent({
  name: 'TestEditor',

  setup: () => {
    const count = ref(0)
    const editor = ref(null)
    onMounted(() => {
      console.log(editor.value)
        new Quill(editor.value, {
          modules: { toolbar },
          theme: 'snow'
        });
    })
    return { count, editor }
  }
})
</script>

<style scoped>
a {
  color: #42b983;
}
</style>
