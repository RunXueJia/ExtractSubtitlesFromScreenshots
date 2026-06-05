<template>
  <ModulePanel class="viewer-panel">
    <div class="media-wrap">
      <video
        v-show="sourceType === 'video'"
        ref="videoRef"
        playsinline
        :src="sourceType === 'video' ? sourceUrl : ''"
        @loadedmetadata="syncTimeline"
        @durationchange="syncTimeline"
        @seeked="syncTimeline"
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
    <div
      v-if="sourceType === 'video'"
      class="video-progress"
      :class="{ 'is-scrubbing': isScrubbing, 'is-disabled': !progressEnabled }"
      role="slider"
      aria-label="视频进度"
      :aria-valuemin="0"
      :aria-valuemax="durationSeconds"
      :aria-valuenow="currentTime"
      :aria-valuetext="timeLabel"
      :aria-disabled="!progressEnabled"
      :tabindex="progressEnabled ? 0 : -1"
      @keydown="handleProgressKeydown"
      @pointerdown="handleProgressPointerDown"
      @pointermove="handleProgressPointerMove"
      @pointerup="handleProgressPointerUp"
      @pointercancel="handleProgressPointerUp"
    >
      <div class="video-progress-track">
        <div class="video-progress-fill" :style="{ width: progressPercent }"></div>
        <div class="video-progress-thumb" :style="{ left: progressPercent }"></div>
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
import { computed, ref, watch } from 'vue';
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
const currentTime = ref(0);
const durationSeconds = ref(0);
const timeLabel = ref('00:00.000 / 00:00.000');
const isScrubbing = ref(false);

const progressEnabled = computed(() => props.sourceType === 'video' && durationSeconds.value > 0);
const progressPercent = computed(() => {
  if (!progressEnabled.value) return '0%';
  const percent = (currentTime.value / durationSeconds.value) * 100;
  return `${Math.min(100, Math.max(0, percent))}%`;
});

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function updateTimeline(current, duration) {
  currentTime.value = Number.isFinite(current) ? Math.max(0, current) : 0;
  durationSeconds.value = Number.isFinite(duration) && duration > 0 ? duration : 0;
  timeLabel.value = `${formatTime(currentTime.value)} / ${formatTime(durationSeconds.value)}`;
}

function syncTimeline() {
  const video = videoRef.value;
  if (!video) return;
  const current = video.currentTime || 0;
  updateTimeline(current, video.duration);
}

function seekToTime(seconds) {
  const video = videoRef.value;
  if (!video || !progressEnabled.value) return;

  const nextTime = Math.min(durationSeconds.value, Math.max(0, seconds));
  video.currentTime = nextTime;
  updateTimeline(nextTime, durationSeconds.value);
}

function seekFromPointer(event) {
  if (!progressEnabled.value) return;

  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
  seekToTime(ratio * durationSeconds.value);
}

function handleProgressPointerDown(event) {
  if (!progressEnabled.value) return;

  isScrubbing.value = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  seekFromPointer(event);
}

function handleProgressPointerMove(event) {
  if (!isScrubbing.value) return;
  seekFromPointer(event);
}

function handleProgressPointerUp(event) {
  if (!isScrubbing.value) return;

  seekFromPointer(event);
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  isScrubbing.value = false;
}

function handleProgressKeydown(event) {
  if (!progressEnabled.value) return;

  const smallStep = event.shiftKey ? 5 : 1;
  const largeStep = 10;
  const keyMap = {
    ArrowLeft: -smallStep,
    ArrowDown: -smallStep,
    ArrowRight: smallStep,
    ArrowUp: smallStep,
    PageDown: -largeStep,
    PageUp: largeStep
  };

  if (event.key === 'Home') {
    event.preventDefault();
    seekToTime(0);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    seekToTime(durationSeconds.value);
    return;
  }

  if (event.key in keyMap) {
    event.preventDefault();
    seekToTime(currentTime.value + keyMap[event.key]);
  }
}

watch(
  () => [props.sourceType, props.sourceUrl],
  () => {
    updateTimeline(0, 0);
    isScrubbing.value = false;
  }
);

defineExpose({
  getVideoElement: () => videoRef.value,
  getImageElement: () => imageRef.value
});
</script>

<style scoped>
.video-progress {
  width: 100%;
  margin-top: 10px;
  padding: 7px 2px;
  cursor: pointer;
  touch-action: none;
}

.video-progress.is-disabled {
  cursor: default;
  opacity: 0.55;
}

.video-progress-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--line);
}

.video-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.video-progress-thumb {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  border: 3px solid var(--accent);
  border-radius: 50%;
  background: var(--panel);
  box-shadow: 0 2px 8px rgba(28, 37, 45, 0.22);
  transform: translate(-50%, -50%);
}

.video-progress:not(.is-disabled):hover .video-progress-thumb,
.video-progress.is-scrubbing .video-progress-thumb,
.video-progress:focus-visible .video-progress-thumb {
  box-shadow: 0 0 0 5px rgba(23, 111, 107, 0.14), 0 2px 8px rgba(28, 37, 45, 0.22);
}

.video-progress:focus-visible {
  border-radius: 8px;
  outline: 2px solid rgba(23, 111, 107, 0.34);
  outline-offset: 2px;
}
</style>
