<template>
  <ModulePanel class="viewer-panel">
    <div class="media-wrap">
      <video
        v-show="sourceType === 'video'"
        ref="videoRef"
        playsinline
        controls
        @loadedmetadata="$emit('sync-timeline')"
        @durationchange="$emit('sync-timeline')"
        @timeupdate="$emit('sync-timeline')"
      ></video>
      <img v-show="sourceType === 'image'" ref="imageRef" alt="" />
      <div v-if="!sourceType" class="empty-state">
        <h2>等待素材</h2>
        <p>视频截帧在浏览器内完成。</p>
      </div>
    </div>
    <div class="timeline-row">
      <el-button type="primary" :icon="Camera" :disabled="sourceType !== 'video' || busy" @click="$emit('capture')">
        截取当前帧
      </el-button>
      <span>{{ timeLabel }}</span>
    </div>
  </ModulePanel>
</template>

<script setup>
import { ref } from 'vue';
import { Camera } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';

defineProps({
  sourceType: {
    type: String,
    default: ''
  },
  timeLabel: {
    type: String,
    required: true
  },
  busy: {
    type: Boolean,
    default: false
  }
});

defineEmits(['sync-timeline', 'capture']);

const videoRef = ref(null);
const imageRef = ref(null);

defineExpose({
  getVideoElement: () => videoRef.value,
  getImageElement: () => imageRef.value
});
</script>
