<template>
  <div class="app-shell">
    <aside class="source-panel">
      <header class="brand">
        <span class="brand-mark">ES</span>
        <div>
          <h1>字幕截图提取</h1>
          <p>视频当前帧与截图字幕识别</p>
        </div>
      </header>

      <section
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
          <el-button type="primary" :icon="VideoPlay" @click="videoInputRef?.click()">选择视频</el-button>
          <el-button :icon="Picture" @click="imageInputRef?.click()">选择截图</el-button>
        </div>
      </section>

      <section class="viewer-panel">
        <div class="media-wrap">
          <video
            v-show="sourceType === 'video'"
            ref="videoRef"
            playsinline
            controls
            @loadedmetadata="syncTimeline"
            @durationchange="syncTimeline"
            @timeupdate="syncTimeline"
          ></video>
          <img v-show="sourceType === 'image'" ref="imageRef" alt="" />
          <div v-if="!sourceType" class="empty-state">
            <h2>等待素材</h2>
            <p>视频截帧在浏览器内完成。</p>
          </div>
        </div>
        <div class="timeline-row">
          <el-button type="primary" :icon="Camera" :disabled="sourceType !== 'video' || busy" @click="captureVideoFrame">
            截取当前帧
          </el-button>
          <span>{{ timeLabel }}</span>
        </div>
      </section>

      <section class="region-panel">
        <div class="panel-title">
          <h2>字幕区域</h2>
          <el-tag type="info">{{ regionLabel }}</el-tag>
        </div>
        <label>
          <span>顶部</span>
          <el-slider v-model="cropTop" :min="0" :max="90" :step="1" @input="normalizeRegion" />
        </label>
        <label>
          <span>底部</span>
          <el-slider v-model="cropBottom" :min="10" :max="100" :step="1" @input="normalizeRegion" />
        </label>
        <el-button type="primary" :icon="View" :loading="ocrStatus === '识别中'" :disabled="!currentFrame || busy" @click="recognizeCurrentFrame">
          识别字幕
        </el-button>
      </section>
    </aside>

    <main class="workspace">
      <section class="result-panel">
        <div class="panel-title">
          <h2>截帧预览</h2>
          <el-tag type="info">{{ frameMeta }}</el-tag>
        </div>
        <div class="frame-grid">
          <div class="frame-preview">
            <img v-if="currentFrame" :src="currentFrame.imageDataUrl" alt="" />
            <el-empty v-else description="暂无截帧" />
            <canvas ref="scratchCanvasRef" hidden></canvas>
          </div>

          <div class="text-stack">
            <div class="panel-title compact">
              <h2>英文字幕</h2>
              <el-tag :type="ocrTagType">{{ ocrStatus }}</el-tag>
            </div>
            <el-input
              v-model="subtitleText"
              class="subtitle-input"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 10 }"
              resize="none"
              placeholder="识别结果"
            />
            <div v-if="markedSubtitleHtml" class="marked-preview" v-html="markedSubtitleHtml"></div>

            <div class="panel-title compact">
              <h2>中文翻译</h2>
              <el-tag :type="translateTagType">{{ translateStatus }}</el-tag>
            </div>
            <el-input
              v-model="translationText"
              class="translation-input"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              resize="none"
              placeholder="翻译结果"
            />
          </div>
        </div>

        <div class="action-bar">
          <el-button :icon="Switch" :loading="translateStatus === '翻译中'" :disabled="!currentFrame || busy" @click="translateCurrentText">
            翻译
          </el-button>
          <el-button :icon="DocumentChecked" :disabled="!currentFrame || busy" @click="saveCurrentText">保存文本</el-button>
          <el-button :icon="CopyDocument" :disabled="!currentFrame || busy" @click="copyCurrentFrame">复制图片</el-button>
          <el-button :icon="Download" :disabled="!currentFrame || busy" @click="downloadCurrentFrame">下载 PNG</el-button>
        </div>
      </section>

      <section class="history-panel">
        <div class="panel-title">
          <h2>本地历史</h2>
          <el-tag>{{ history.length }}</el-tag>
        </div>
        <el-empty v-if="!history.length" description="暂无历史" />
        <div v-else class="history-list">
          <div v-for="item in history" :key="item.id" class="history-row">
            <button class="history-item" :class="{ active: selectedId === item.id }" type="button" @click="selectFrame(item)">
              <img :src="item.imageDataUrl" alt="" />
              <span>
                <strong>{{ item.sourceName }}</strong>
                <small>{{ item.text || item.translation || formatTime(item.seconds) }}</small>
              </span>
            </button>
            <el-button type="danger" plain @click="deleteHistory(item.id)">删除</el-button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Camera,
  CopyDocument,
  DocumentChecked,
  Download,
  Picture,
  Switch,
  VideoPlay,
  View
} from '@element-plus/icons-vue';

import { extractSubtitle, translateSubtitle } from './api/client.js';

const HISTORY_KEY = 'extract-subtitles.history.v1';
const MAX_HISTORY = 20;

const videoInputRef = ref(null);
const imageInputRef = ref(null);
const videoRef = ref(null);
const imageRef = ref(null);
const scratchCanvasRef = ref(null);

const sourceType = ref('');
const sourceName = ref('');
const sourceUrl = ref('');
const currentFrame = ref(null);
const selectedId = ref('');
const history = ref(loadHistory());
const busy = ref(false);
const isDragging = ref(false);
const cropTop = ref(55);
const cropBottom = ref(82);
const timeLabel = ref('00:00.000 / 00:00.000');
const subtitleText = ref('');
const translationText = ref('');
const ocrStatus = ref('未识别');
const translateStatus = ref('待翻译');

const regionLabel = computed(() => `${cropTop.value}% - ${cropBottom.value}%`);
const frameMeta = computed(() => {
  const frame = currentFrame.value;
  if (!frame) return '尚无截帧';
  return `${frame.width} x ${frame.height}${frame.bytes ? ` · ${frame.bytes}` : ''}`;
});

const markedSubtitleHtml = computed(() => renderMarkedSubtitle(subtitleText.value));
const ocrTagType = computed(() => (ocrStatus.value.includes('失败') ? 'danger' : ocrStatus.value.includes('已') ? 'success' : 'info'));
const translateTagType = computed(() =>
  translateStatus.value.includes('失败') ? 'danger' : translateStatus.value.includes('已') ? 'success' : 'info'
);

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(0, MAX_HISTORY)));
  } catch {
    history.value = history.value.slice(0, 1);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
    ElMessage.warning('浏览器本地历史空间不足，已仅保留最新记录。');
  }
}

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatBytesFromDataUrl(dataUrl) {
  if (!dataUrl) return '';
  const base64 = dataUrl.split(',')[1] || '';
  const bytes = Math.round(base64.length * 0.75);
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderMarkedSubtitle(value) {
  const source = String(value || '');
  const parts = [];
  let cursor = 0;
  const markPattern = /<mark>(.*?)<\/mark>/gis;
  let match;

  while ((match = markPattern.exec(source))) {
    parts.push(escapeHtml(source.slice(cursor, match.index)));
    parts.push(`<span class="marked-token">${escapeHtml(match[1])}</span>`);
    cursor = match.index + match[0].length;
  }

  parts.push(escapeHtml(source.slice(cursor)));
  return parts.join('').replace(/\n/g, '<br>');
}

function normalizeRegion() {
  if (cropBottom.value <= cropTop.value + 8) {
    cropBottom.value = Math.min(100, cropTop.value + 8);
  }
}

function clearFrameText() {
  subtitleText.value = '';
  translationText.value = '';
  ocrStatus.value = '未识别';
  translateStatus.value = '待翻译';
}

function revokeSourceUrl() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
  sourceUrl.value = '';
}

async function setSource(file, type) {
  if (!file) return;
  revokeSourceUrl();
  sourceType.value = type;
  sourceName.value = file.name;
  sourceUrl.value = URL.createObjectURL(file);
  currentFrame.value = null;
  selectedId.value = '';
  clearFrameText();

  await nextTick();
  if (type === 'video') {
    videoRef.value.src = sourceUrl.value;
    syncTimeline();
    ElMessage.success('视频已载入');
    return;
  }

  imageRef.value.src = sourceUrl.value;
  imageRef.value.onload = () => {
    captureImagePreview();
    ElMessage.success('截图已载入');
  };
}

function handleVideoChange(event) {
  setSource(event.target.files?.[0], 'video');
  event.target.value = '';
}

function handleImageChange(event) {
  setSource(event.target.files?.[0], 'image');
  event.target.value = '';
}

function handleDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  if (file.type.startsWith('video/')) setSource(file, 'video');
  else if (file.type.startsWith('image/')) setSource(file, 'image');
  else ElMessage.warning('只支持视频或图片文件。');
}

function syncTimeline() {
  const video = videoRef.value;
  if (!video) return;
  const current = video.currentTime || 0;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  timeLabel.value = `${formatTime(current)} / ${formatTime(duration)}`;
}

function createFrameItem(dataUrl, meta = {}) {
  const item = {
    id: `frame-${Date.now()}`,
    sourceType: sourceType.value,
    sourceName: sourceName.value || '未命名素材',
    imageDataUrl: dataUrl,
    seconds: meta.seconds || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    bytes: formatBytesFromDataUrl(dataUrl),
    text: '',
    translation: '',
    createdAt: new Date().toISOString()
  };

  currentFrame.value = item;
  selectedId.value = item.id;
  history.value = [item, ...history.value.filter(entry => entry.id !== item.id)].slice(0, MAX_HISTORY);
  persistHistory();
  clearFrameText();
  return item;
}

function captureVideoFrame() {
  const video = videoRef.value;
  if (!video?.videoWidth || !video?.videoHeight) {
    ElMessage.warning('视频尚未准备好。');
    return;
  }

  const canvas = scratchCanvasRef.value;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  createFrameItem(canvas.toDataURL('image/png'), {
    seconds: video.currentTime || 0,
    width: canvas.width,
    height: canvas.height
  });
  ElMessage.success('已截取当前帧');
}

function captureImagePreview() {
  const image = imageRef.value;
  if (!image?.naturalWidth || !image?.naturalHeight) return;

  const canvas = scratchCanvasRef.value;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  createFrameItem(canvas.toDataURL('image/png'), {
    width: canvas.width,
    height: canvas.height
  });
}

async function prepareSubtitleImage(frame) {
  const image = new Image();
  image.src = frame.imageDataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  normalizeRegion();
  const cropX = Math.floor(image.naturalWidth * 0.08);
  const cropWidth = Math.floor(image.naturalWidth * 0.84);
  const cropY = Math.floor(image.naturalHeight * (cropTop.value / 100));
  const cropHeight = Math.max(1, Math.floor(image.naturalHeight * ((cropBottom.value - cropTop.value) / 100)));
  const scale = 3;

  const canvas = scratchCanvasRef.value;
  canvas.width = cropWidth * scale;
  canvas.height = cropHeight * scale;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function updateSelectedFrame(patch) {
  if (!currentFrame.value) return;
  const next = { ...currentFrame.value, ...patch };
  currentFrame.value = next;
  history.value = history.value.map(item => (item.id === next.id ? next : item));
  persistHistory();
}

function selectFrame(item) {
  currentFrame.value = item;
  selectedId.value = item.id;
  subtitleText.value = item.text || '';
  translationText.value = item.translation || '';
  ocrStatus.value = item.text ? '已保存' : '未识别';
  translateStatus.value = item.translation ? '已翻译' : '待翻译';
}

function deleteHistory(id) {
  history.value = history.value.filter(item => item.id !== id);
  if (selectedId.value === id) {
    currentFrame.value = history.value[0] || null;
    if (currentFrame.value) selectFrame(currentFrame.value);
    else {
      selectedId.value = '';
      clearFrameText();
    }
  }
  persistHistory();
}

async function recognizeCurrentFrame() {
  if (!currentFrame.value) return;

  try {
    busy.value = true;
    ocrStatus.value = '识别中';
    const imageDataUrl = await prepareSubtitleImage(currentFrame.value);
    const text = (await extractSubtitle(imageDataUrl)).trim();
    subtitleText.value = text;
    ocrStatus.value = text ? '已识别' : '空结果';
    updateSelectedFrame({ text });
    ElMessage.success('字幕识别完成');
  } catch (error) {
    ocrStatus.value = '识别失败';
    ElMessage.error(error.message || '字幕识别失败');
  } finally {
    busy.value = false;
  }
}

async function translateCurrentText() {
  const text = subtitleText.value.trim();
  if (!currentFrame.value || !text) {
    ElMessage.warning('没有可翻译的字幕。');
    return;
  }

  try {
    busy.value = true;
    translateStatus.value = '翻译中';
    const translation = (await translateSubtitle(text)).trim();
    translationText.value = translation;
    translateStatus.value = translation ? '已翻译' : '空结果';
    updateSelectedFrame({ text, translation });
    ElMessage.success('翻译已生成');
  } catch (error) {
    translateStatus.value = '翻译失败';
    ElMessage.error(error.message || '翻译失败');
  } finally {
    busy.value = false;
  }
}

function saveCurrentText() {
  if (!currentFrame.value) return;
  updateSelectedFrame({
    text: subtitleText.value.trim(),
    translation: translationText.value.trim()
  });
  ElMessage.success('文本已保存');
}

async function copyCurrentFrame() {
  if (!currentFrame.value) return;

  try {
    const response = await fetch(currentFrame.value.imageDataUrl);
    const blob = await response.blob();
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('当前浏览器不支持直接复制图片，请使用下载。');
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || 'image/png']: blob
      })
    ]);
    ElMessage.success('图片已复制');
  } catch (error) {
    ElMessage.error(error.message || '复制失败');
  }
}

function downloadCurrentFrame() {
  if (!currentFrame.value) return;
  const link = document.createElement('a');
  link.href = currentFrame.value.imageDataUrl;
  link.download = `${currentFrame.value.id}.png`;
  link.click();
}

onMounted(() => {
  if (history.value[0]) selectFrame(history.value[0]);
});
</script>
