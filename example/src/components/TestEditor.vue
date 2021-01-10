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
      console.log(editor.value);
      (window as any).Quill = Quill;
      (window as any).editor = new Quill(editor.value, {
        modules: { toolbar },
        theme: 'snow'
      });
    })
    return { count, editor }
  }
})
</script>

<style lang="stylus">
.quill-editor {
  height: 20rem;
}

.ql-editor {
  &::-webkit-scrollbar {
    width: 0.5rem;
    height: 0.5rem;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 0;
    background-color: rgba(36, 41, 46, 0.9);
    transition: background-color 0.15s;
  }

  &::-webkit-scrollbar-track {
    border-radius: 0;
  }
}
</style>
