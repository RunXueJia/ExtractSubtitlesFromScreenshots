<template>
  <div class="panel-title" :class="{ compact }">
    <div class="panel-title-main">
      <h2>{{ title }}</h2>
      <slot name="title-extra" />
    </div>
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
