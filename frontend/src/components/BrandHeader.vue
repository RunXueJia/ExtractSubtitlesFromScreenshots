<template>
  <header class="brand">
    <span class="brand-mark">{{ mark }}</span>
    <div>
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
  </header>
</template>

<script setup>
defineProps({
  mark: {
    type: String,
    default: 'ES'
  },
  title: {
    type: String,
    default: '字幕截图提取'
  },
  subtitle: {
    type: String,
    default: '视频当前帧与截图字幕识别'
  }
});
</script>
