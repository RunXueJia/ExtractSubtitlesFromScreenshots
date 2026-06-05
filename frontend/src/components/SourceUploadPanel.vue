<template>
  <ModulePanel
    class="upload-zone"
    :class="{ 'drag-over': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input ref="videoInputRef" type="file" accept="video/*" hidden @change="handleVideoChange" />
    <input ref="imageInputRef" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleImageChange" />
    <div>
      <strong>载入素材</strong>
      <span>{{ sourceName || '未选择' }}</span>
    </div>
    <div class="upload-actions">
      <el-button type="primary" :icon="VideoPlay" @click="chooseVideo">选择视频</el-button>
      <el-button :icon="Picture" @click="chooseImage">选择截图</el-button>
    </div>
  </ModulePanel>
</template>

<script setup>
import { ref } from 'vue';
import { Picture, VideoPlay } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';

defineProps({
  sourceName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select-source', 'reject-source']);

const videoInputRef = ref(null);
const imageInputRef = ref(null);
const isDragging = ref(false);

function chooseVideo() {
  videoInputRef.value?.click();
}

function chooseImage() {
  imageInputRef.value?.click();
}

function selectSource(file, type) {
  if (!file) return;
  emit('select-source', { file, type });
}

function handleVideoChange(event) {
  selectSource(event.target.files?.[0], 'video');
  event.target.value = '';
}

function handleImageChange(event) {
  selectSource(event.target.files?.[0], 'image');
  event.target.value = '';
}

function handleDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  if (file.type.startsWith('video/')) {
    selectSource(file, 'video');
  } else if (file.type.startsWith('image/')) {
    selectSource(file, 'image');
  } else {
    emit('reject-source');
  }
}
</script>
