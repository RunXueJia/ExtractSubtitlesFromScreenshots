<template>
  <ModulePanel class="viewer-panel">
    <div class="media-wrap">
      <video
        v-show="sourceType === 'video'"
        ref="videoRef"
        playsinline
        controls
        :src="sourceType === 'video' ? sourceUrl : ''"
        @loadedmetadata="syncTimeline"
        @durationchange="syncTimeline"
        @timeupdate="syncTimeline"
      ></video>
      <img
        v-show="sourceType === 'image'"
        ref="imageRef"
        :src="sourceType === 'image' ? sourceUrl : ''"
        alt=""
        @load="$emit('image-ready')"
        @error="$emit('image-error')"
      />
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
import { ref, watch } from 'vue';
import { Camera } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';

const props = defineProps({
  sourceType: {
    type: String,
    default: ''
  },
  sourceUrl: {
    type: String,
    default: ''
  },
  busy: {
    type: Boolean,
    default: false
  }
});

defineEmits(['capture', 'image-ready', 'image-error']);

const videoRef = ref(null);
const imageRef = ref(null);
const timeLabel = ref('00:00.000 / 00:00.000');
const emptyTimeLabel = '00:00.000 / 00:00.000';

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function syncTimeline() {
  const video = videoRef.value;
  if (!video) return;
  const current = video.currentTime || 0;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  timeLabel.value = `${formatTime(current)} / ${formatTime(duration)}`;
}

watch(
  () => [props.sourceType, props.sourceUrl],
  () => {
    timeLabel.value = emptyTimeLabel;
  }
);

defineExpose({
  getVideoElement: () => videoRef.value,
  getImageElement: () => imageRef.value
});
</script>
