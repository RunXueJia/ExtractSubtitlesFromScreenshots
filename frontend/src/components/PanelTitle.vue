<template>
  <div class="panel-title" :class="{ compact }">
    <h2>{{ title }}</h2>
    <slot name="meta" />
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
});
</script>
