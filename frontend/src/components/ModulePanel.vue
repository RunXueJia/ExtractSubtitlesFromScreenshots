<template>
  <component
    :is="tag"
    class="module-panel"
    :class="{
      'module-panel--attention': attention,
      'module-panel--padded': padded
    }"
    v-bind="$attrs"
  >
    <slot />
  </component>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
});

defineProps({
  tag: {
    type: String,
    default: 'section'
  },
  attention: {
    type: Boolean,
    default: false
  },
  padded: {
    type: Boolean,
    default: true
  }
});
</script>
