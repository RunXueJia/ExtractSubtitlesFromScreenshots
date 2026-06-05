<template>
  <ModulePanel class="viewer-panel">
    <div class="media-wrap">
      <video
        v-show="sourceType === 'video'"
        ref="videoRef"
        playsinline
        :src="sourceType === 'video' ? sourceUrl : ''"
        @loadedmetadata="handleVideoLoaded"
        @durationchange="syncTimeline"
        @ended="syncPlaybackState"
        @pause="syncPlaybackState"
        @play="syncPlaybackState"
        @ratechange="syncPlaybackSettings"
        @seeked="syncTimeline"
        @timeupdate="syncTimeline"
        @volumechange="syncPlaybackSettings"
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
      :class="{ 'is-disabled': !progressEnabled }"
    >
      <el-slider
        v-model="currentTime"
        :min="0"
        :max="progressSliderMax"
        :step="0.01"
        :disabled="!progressEnabled"
        :show-tooltip="true"
        :format-tooltip="formatProgressTooltip"
        :format-value-text="formatTime"
        aria-label="视频进度"
        @input="handleProgressInput"
        @change="handleProgressChange"
      />
    </div>
    <div v-if="sourceType === 'video'" class="video-controls" :class="{ 'is-disabled': !videoControlsEnabled }">
      <el-button
        class="playback-button"
        type="primary"
        :icon="isPlaying ? VideoPause : VideoPlay"
        :disabled="!videoControlsEnabled"
        :aria-label="isPlaying ? '暂停视频' : '播放视频'"
        @click="togglePlayback"
      >
        {{ isPlaying ? '暂停' : '播放' }}
      </el-button>
      <div class="control-field volume-field">
        <span class="control-label">
          <el-icon><Headset /></el-icon>
          音量
        </span>
        <el-slider
          v-model="volumeSliderValue"
          class="volume-slider"
          :min="0"
          :max="100"
          :step="1"
          :disabled="!videoControlsEnabled"
          :show-tooltip="false"
          aria-label="音量"
          :format-value-text="formatVolumeValueText"
        />
        <span class="control-value">{{ volumePercent }}</span>
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
import { computed, nextTick, ref, watch } from 'vue';
import { Camera, Clock, Headset, VideoPause, VideoPlay } from '@element-plus/icons-vue';

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
const isSeeking = ref(false);
const isPlaying = ref(false);
const volume = ref(0.3);
const playbackRate = ref(1);
const playbackRateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

const videoControlsEnabled = computed(() => props.sourceType === 'video' && Boolean(props.sourceUrl));
const progressEnabled = computed(() => props.sourceType === 'video' && durationSeconds.value > 0);
const progressSliderMax = computed(() => (progressEnabled.value ? durationSeconds.value : 0));
const volumePercent = computed(() => `${Math.round(volume.value * 100)}%`);
const volumeSliderValue = computed({
  get: () => Math.round(volume.value * 100),
  set: value => setVolume(value / 100)
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
  const current = isSeeking.value ? currentTime.value : video.currentTime || 0;
  updateTimeline(current, video.duration);
}

function syncPlaybackState() {
  const video = videoRef.value;
  isPlaying.value = Boolean(video && !video.paused && !video.ended);
}

function syncPlaybackSettings() {
  const video = videoRef.value;
  if (!video) return;

  volume.value = video.volume;
  playbackRate.value = video.playbackRate;
  syncPlaybackState();
}

function applyPlaybackSettings() {
  const video = videoRef.value;
  if (!video) return;

  video.volume = Math.min(1, Math.max(0, volume.value));
  video.playbackRate = playbackRate.value;
  syncPlaybackState();
}

function handleVideoLoaded() {
  applyPlaybackSettings();
  syncTimeline();
}

async function togglePlayback() {
  const video = videoRef.value;
  if (!video || !videoControlsEnabled.value) return;

  if (video.paused || video.ended) {
    if (video.ended) seekToTime(0);

    try {
      await video.play();
    } catch {
      syncPlaybackState();
    }
    return;
  }

  video.pause();
  syncPlaybackState();
}

function setVolume(value) {
  const nextVolume = Math.min(1, Math.max(0, Number(value)));
  volume.value = Number.isFinite(nextVolume) ? nextVolume : 1;

  const video = videoRef.value;
  if (video) video.volume = volume.value;
}

function setPlaybackRate(value) {
  const nextRate = Number(value);
  playbackRate.value = playbackRateOptions.includes(nextRate) ? nextRate : 1;

  const video = videoRef.value;
  if (video) video.playbackRate = playbackRate.value;
}

function formatPlaybackRate(rate) {
  return `${rate}x`;
}

function formatProgressTooltip(value) {
  return formatTime(value);
}

function formatVolumeValueText(value) {
  return `${Math.round(value)}%`;
}

function seekToTime(seconds) {
  const video = videoRef.value;
  if (!video || !progressEnabled.value) return;

  const nextTime = Math.min(durationSeconds.value, Math.max(0, seconds));
  video.currentTime = nextTime;
  updateTimeline(nextTime, durationSeconds.value);
}

function handleProgressInput(value) {
  if (!progressEnabled.value) return;
  isSeeking.value = true;
  updateTimeline(value, durationSeconds.value);
  seekToTime(value);
}

function handleProgressChange(value) {
  if (!progressEnabled.value) return;
  seekToTime(value);
  isSeeking.value = false;
  syncTimeline();
}

watch(
  () => [props.sourceType, props.sourceUrl],
  async () => {
    updateTimeline(0, 0);
    isSeeking.value = false;
    isPlaying.value = false;
    await nextTick();
    applyPlaybackSettings();
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
  margin-top: 8px;
  padding: 0 4px;
}

.video-progress.is-disabled {
  opacity: 0.55;
}

.video-progress :deep(.el-slider) {
  --el-slider-main-bg-color: var(--accent);
  --el-slider-runway-bg-color: var(--line);
  --el-slider-stop-bg-color: var(--panel);
  --el-slider-button-size: 16px;
  --el-slider-height: 8px;
  margin: 0;
}

.video-controls {
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-top: 6px;
}

.video-controls.is-disabled {
  opacity: 0.7;
}

.playback-button {
  flex: none;
}

.control-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-muted);
  color: var(--ink);
}

.control-label {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.control-label .el-icon {
  color: var(--accent);
}

.volume-slider {
  --el-slider-main-bg-color: var(--accent);
  --el-slider-runway-bg-color: var(--line);
  --el-slider-button-size: 14px;
  --el-slider-height: 6px;
  min-width: 92px;
  flex: 1;
  margin: 0;
}

.control-value {
  flex: none;
  min-width: 38px;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  text-align: right;
}

.speed-select {
  width: 128px;
}

.speed-field {
  grid-column: 1 / -1;
  justify-content: space-between;
  height: 40px;
}

.speed-select :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 800;
}

@media (max-width: 620px) {
  .video-controls {
    grid-template-columns: 1fr;
  }

  .control-field {
    width: 100%;
  }
}
</style>
