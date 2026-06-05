<template>
  <ModulePanel class="result-panel">
    <PanelTitle title="截帧预览">
      <template #meta>
        <el-tag type="info">{{ frameMeta }}</el-tag>
      </template>
    </PanelTitle>
    <div class="frame-grid">
      <div class="frame-side">
        <input ref="imageInputRef" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleImageChange" />
        <div
          class="frame-preview"
          :class="{ 'frame-preview--empty': canImportImage, 'frame-preview--drop-ready': isDraggingImage }"
          :tabindex="canImportImage ? 0 : undefined"
          :aria-label="canImportImage ? '点击选择图片，或拖拽、粘贴图片到截帧预览区' : undefined"
          @click="chooseImage"
          @dragenter.prevent="handleFrameDragover"
          @dragover.prevent="handleFrameDragover"
          @dragleave="handleFrameDragleave"
          @drop.prevent="handleFrameDrop"
          @keydown.enter.prevent="chooseImage"
          @keydown.space.prevent="chooseImage"
          @paste="handleFramePaste"
        >
          <template v-if="currentFrame?.previewUrl">
            <img class="frame-preview-bg" :src="currentFrame.previewUrl" alt="" aria-hidden="true" />
            <img class="frame-preview-image" :src="currentFrame.previewUrl" alt="" />
          </template>
          <el-empty v-else-if="currentFrame" description="需要重新授权目录" />
          <el-empty v-else description="暂无截帧">
            <template #description>
              <div class="frame-empty-copy">
                <strong>暂无截帧</strong>
                <span>点击选择图片，或拖拽、粘贴图片</span>
              </div>
            </template>
          </el-empty>
          <canvas ref="scratchCanvasRef" hidden></canvas>
        </div>

        <div class="region-controls">
          <PanelTitle title="字幕区域" compact>
            <template #meta>
              <el-tag type="info">{{ regionLabel }}</el-tag>
            </template>
          </PanelTitle>
          <label>
            <span>顶部</span>
            <el-slider v-model="topValue" :min="0" :max="90" :step="1" />
          </label>
          <label>
            <span>底部</span>
            <el-slider v-model="bottomValue" :min="10" :max="100" :step="1" />
          </label>
          <el-button
            class="region-recognize-button"
            type="primary"
            :icon="View"
            :loading="ocrStatus === '识别中'"
            :disabled="!currentFrame || busy"
            @click="$emit('recognize')"
          >
            识别字幕
          </el-button>
        </div>
      </div>

      <div class="text-stack">
        <PanelTitle title="英文字幕" compact>
          <template #meta>
            <el-tag :type="ocrTagType">{{ ocrStatus }}</el-tag>
          </template>
        </PanelTitle>
        <el-input
          v-model="subtitleModel"
          class="subtitle-input"
          type="textarea"
          :autosize="{ minRows: 5, maxRows: 10 }"
          resize="none"
          placeholder="识别结果"
        />
        <div v-if="markedSubtitleHtml" class="marked-preview" v-html="markedSubtitleHtml"></div>

        <PanelTitle title="中文翻译" compact>
          <template #meta>
            <el-tag :type="translateTagType">{{ translateStatus }}</el-tag>
          </template>
        </PanelTitle>
        <el-input
          v-model="translationModel"
          class="translation-input"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          resize="none"
          placeholder="翻译结果"
        />
      </div>
    </div>

    <div class="action-bar">
      <el-button
        class="action-button action-button--primary"
        :icon="Switch"
        :loading="translateStatus === '翻译中'"
        :disabled="!currentFrame || busy"
        @click="$emit('translate')"
      >
        翻译
      </el-button>
      <el-button :icon="DocumentChecked" :disabled="!currentFrame || busy" @click="$emit('save')">保存文本</el-button>
      <el-button class="action-button action-button--primary" :icon="CopyDocument" :disabled="!currentFrame || busy" @click="$emit('copy')">
        复制图片
      </el-button>
      <el-button class="action-button action-button--primary" :icon="Download" :disabled="!currentFrame || busy" @click="$emit('download')">
        下载 PNG
      </el-button>
    </div>
  </ModulePanel>
</template>

<script setup>
import { computed, ref } from 'vue';
import { CopyDocument, DocumentChecked, Download, Switch, View } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';
import PanelTitle from './PanelTitle.vue';

const props = defineProps({
  currentFrame: {
    type: Object,
    default: null
  },
  cropTop: {
    type: Number,
    required: true
  },
  cropBottom: {
    type: Number,
    required: true
  },
  subtitleText: {
    type: String,
    required: true
  },
  translationText: {
    type: String,
    required: true
  },
  ocrStatus: {
    type: String,
    required: true
  },
  translateStatus: {
    type: String,
    required: true
  },
  busy: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:cropTop',
  'update:cropBottom',
  'update:subtitleText',
  'update:translationText',
  'recognize',
  'translate',
  'save',
  'copy',
  'download',
  'select-image',
  'reject-image'
]);

const scratchCanvasRef = ref(null);
const imageInputRef = ref(null);
const isDraggingImage = ref(false);

const frameMeta = computed(() => {
  const frame = props.currentFrame;
  if (!frame) return '尚无截帧';
  return `${frame.width} x ${frame.height}${frame.bytes ? ` · ${frame.bytes}` : ''}`;
});

const canImportImage = computed(() => !props.currentFrame && !props.busy);
const markedSubtitleHtml = computed(() => renderMarkedSubtitle(props.subtitleText));
const ocrTagType = computed(() => (props.ocrStatus.includes('失败') ? 'danger' : props.ocrStatus.includes('已') ? 'success' : 'info'));
const translateTagType = computed(() =>
  props.translateStatus.includes('失败') ? 'danger' : props.translateStatus.includes('已') ? 'success' : 'info'
);

const regionLabel = computed(() => `${props.cropTop}% - ${props.cropBottom}%`);

const subtitleModel = computed({
  get: () => props.subtitleText,
  set: value => emit('update:subtitleText', value)
});

const translationModel = computed({
  get: () => props.translationText,
  set: value => emit('update:translationText', value)
});

const topValue = computed({
  get: () => props.cropTop,
  set: value => {
    emit('update:cropTop', value);
    emit('update:cropBottom', normalizeRegion(value, props.cropBottom));
  }
});

const bottomValue = computed({
  get: () => props.cropBottom,
  set: value => emit('update:cropBottom', normalizeRegion(props.cropTop, value))
});

function normalizeRegion(top, bottom) {
  if (bottom <= top + 8) return Math.min(100, top + 8);
  return bottom;
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith('image/'));
}

function hasImageTransferItem(items) {
  return Array.from(items || []).some(item => item.kind === 'file' && (!item.type || item.type.startsWith('image/')));
}

function getImageFileFromItems(items) {
  for (const item of Array.from(items || [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

function getImageFileFromFiles(files) {
  return Array.from(files || []).find(isImageFile) || null;
}

function getImageFileNameExtension(type) {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'png';
}

function ensureNamedImageFile(file, prefix = 'pasted-image') {
  if (file.name) return file;

  const extension = getImageFileNameExtension(file.type);
  return new File([file], `${prefix}-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: file.lastModified || Date.now()
  });
}

function emitImageFile(file, prefix) {
  if (!canImportImage.value || !file) return;
  emit('select-image', ensureNamedImageFile(file, prefix));
}

function chooseImage() {
  if (!canImportImage.value) return;
  imageInputRef.value?.click();
}

function handleImageChange(event) {
  emitImageFile(event.target.files?.[0], 'selected-image');
  event.target.value = '';
}

function handleFrameDragover(event) {
  if (!canImportImage.value) return;

  if (hasImageTransferItem(event.dataTransfer?.items) || getImageFileFromFiles(event.dataTransfer?.files)) {
    isDraggingImage.value = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  } else if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'none';
  }
}

function handleFrameDragleave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  isDraggingImage.value = false;
}

function handleFrameDrop(event) {
  isDraggingImage.value = false;
  if (!canImportImage.value) return;

  const file = getImageFileFromFiles(event.dataTransfer?.files) || getImageFileFromItems(event.dataTransfer?.items);
  if (file) {
    emitImageFile(file, 'dropped-image');
  } else {
    emit('reject-image');
  }
}

function handleFramePaste(event) {
  if (!canImportImage.value) return;

  const file = getImageFileFromFiles(event.clipboardData?.files) || getImageFileFromItems(event.clipboardData?.items);
  if (!file) return;

  event.preventDefault();
  emitImageFile(file, 'pasted-image');
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

defineExpose({
  getScratchCanvasElement: () => scratchCanvasRef.value
});
</script>
