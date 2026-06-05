<template>
  <ModulePanel class="result-panel">
    <PanelTitle title="截帧预览">
      <template #title-extra>
        <span v-if="!showImageActions" class="frame-action-tip">
          图片区域右击复制或保存图片
        </span>
      </template>
      <template #meta>
        <div class="frame-title-actions">
          <el-button
            v-if="currentFrame"
            class="clear-frame-button"
            size="small"
            plain
            :disabled="busy"
            @click="$emit('clear')">
            清除图片
          </el-button>
          <el-tag type="info">{{ frameMeta }}</el-tag>
        </div>
      </template>
    </PanelTitle>
    <div class="frame-grid">
      <div class="preview-section">
        <input
          ref="imageInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          @change="handleImageChange" />
        <div
          class="frame-preview"
          :class="{
            'frame-preview--empty': canImportImage,
            'frame-preview--drop-ready': isDraggingImage,
          }"
          :tabindex="canImportImage ? 0 : undefined"
          :aria-label="
            canImportImage
              ? '拖拽或粘贴图片到截帧预览区，也可以使用选择图片按钮导入'
              : undefined
          "
          @dragenter.prevent="handleFrameDragover"
          @dragover.prevent="handleFrameDragover"
          @dragleave="handleFrameDragleave"
          @drop.prevent="handleFrameDrop"
          @paste="handleFramePaste">
          <template v-if="currentFrame?.previewUrl">
            <div ref="previewMediaRef" class="frame-preview-media">
              <img
                ref="previewImageRef"
                class="frame-preview-image"
                :src="currentFrame.previewUrl"
                alt=""
                draggable="false"
                @load="updatePreviewImageBox" />
              <div
                class="subtitle-region-overlay"
                :class="{ 'subtitle-region-overlay--dragging': regionDrag }"
                :style="regionOverlayStyle"
                title="拖拽调整字幕区域"
                @pointerdown="startRegionDrag($event, 'move')">
                <span
                  class="subtitle-region-handle subtitle-region-handle--top"
                  @pointerdown.stop="startRegionDrag($event, 'top')"></span>
                <span
                  class="subtitle-region-handle subtitle-region-handle--bottom"
                  @pointerdown.stop="startRegionDrag($event, 'bottom')"></span>
              </div>
            </div>
          </template>
          <el-empty v-else-if="currentFrame" description="需要重新授权目录" />
          <el-empty v-else description="暂无截帧">
            <template #description>
              <div class="frame-empty-copy">
                <strong>暂无截帧</strong>
                <span>可拖拽或粘贴图片</span>
                <el-button
                  class="frame-import-button"
                  type="primary"
                  :disabled="!canImportImage"
                  @click="chooseImage">
                  选择图片
                </el-button>
              </div>
            </template>
          </el-empty>
          <canvas ref="scratchCanvasRef" hidden></canvas>
        </div>
      </div>

      <div class="text-grid">
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
            resize="none"
            placeholder="识别结果" />
          <div
            v-if="markedSubtitleHtml"
            class="marked-preview"
            v-html="markedSubtitleHtml"></div>
        </div>

        <div class="text-stack">
          <PanelTitle title="中文翻译" compact>
            <template #meta>
              <el-tag :type="translateTagType">{{ translateStatus }}</el-tag>
            </template>
          </PanelTitle>
          <el-input
            v-model="translationModel"
            class="translation-input"
            type="textarea"
            resize="none"
            placeholder="翻译结果" />
        </div>
      </div>
    </div>

    <div class="action-bar">
      <el-button
        class="action-button action-button--primary"
        type="primary"
        :icon="View"
        :loading="ocrStatus === '识别中'"
        :disabled="!currentFrame || busy"
        @click="$emit('recognize')">
        识别字幕
      </el-button>
      <el-button
        class="action-button action-button--primary"
        :icon="Switch"
        :loading="translateStatus === '翻译中'"
        :disabled="!currentFrame || busy"
        @click="$emit('translate')">
        翻译
      </el-button>
      <el-button
        :icon="DocumentCopy"
        :disabled="!currentFrame || busy"
        @click="$emit('copy-text')"
        >复制文本</el-button
      >
      <el-button
        v-if="showImageActions"
        class="action-button action-button--primary"
        :icon="CopyDocument"
        :disabled="!currentFrame || busy"
        @click="$emit('copy')">
        复制图片
      </el-button>
      <a
        v-if="showImageActions"
        class="el-button el-button--primary action-button action-button--primary download-button-link"
        :class="{ 'is-disabled': !canDownload }"
        :href="canDownload ? downloadUrl : undefined"
        :download="canDownload ? downloadFileName : undefined"
        :aria-disabled="!canDownload"
        :tabindex="canDownload ? 0 : -1"
        @click="handleDownloadClick">
        <span class="el-icon"><Download /></span>
        <span>下载 PNG</span>
      </a>
    </div>
  </ModulePanel>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  CopyDocument,
  DocumentCopy,
  Download,
  Switch,
  View,
} from "@element-plus/icons-vue";
import MarkdownIt from "markdown-it";
import markdownItMark from "markdown-it-mark";

import ModulePanel from "./ModulePanel.vue";
import PanelTitle from "./PanelTitle.vue";

const markdownRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
}).use(markdownItMark);

const props = defineProps({
  currentFrame: {
    type: Object,
    default: null,
  },
  downloadUrl: {
    type: String,
    default: "",
  },
  downloadFileName: {
    type: String,
    default: "",
  },
  showImageActions: {
    type: Boolean,
    default: true,
  },
  cropTop: {
    type: Number,
    required: true,
  },
  cropBottom: {
    type: Number,
    required: true,
  },
  subtitleText: {
    type: String,
    required: true,
  },
  translationText: {
    type: String,
    required: true,
  },
  ocrStatus: {
    type: String,
    required: true,
  },
  translateStatus: {
    type: String,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:cropTop",
  "update:cropBottom",
  "update:subtitleText",
  "update:translationText",
  "recognize",
  "translate",
  "copy-text",
  "copy",
  "clear",
  "select-image",
  "reject-image",
]);

const scratchCanvasRef = ref(null);
const imageInputRef = ref(null);
const previewMediaRef = ref(null);
const previewImageRef = ref(null);
const isDraggingImage = ref(false);
const regionDrag = ref(null);
const previewImageBox = ref({ left: 0, top: 0, width: 0, height: 0 });
const MIN_REGION_HEIGHT = 8;
let previewResizeObserver = null;

const frameMeta = computed(() => {
  const frame = props.currentFrame;
  if (!frame) return "尚无截帧";
  return `${frame.width} x ${frame.height}${frame.bytes ? ` · ${frame.bytes}` : ""}`;
});

const canImportImage = computed(() => !props.currentFrame && !props.busy);
const canDownload = computed(() =>
  Boolean(props.showImageActions && props.currentFrame && !props.busy && props.downloadUrl),
);
const markedSubtitleHtml = computed(() =>
  renderMarkdownSubtitle(props.subtitleText),
);
const ocrTagType = computed(() =>
  props.ocrStatus.includes("失败")
    ? "danger"
    : props.ocrStatus.includes("已")
      ? "success"
      : "info",
);
const translateTagType = computed(() =>
  props.translateStatus.includes("失败")
    ? "danger"
    : props.translateStatus.includes("已")
      ? "success"
      : "info",
);

function handleDownloadClick(event) {
  if (canDownload.value) return;
  event.preventDefault();
}

const regionLabel = computed(() => `${props.cropTop}% - ${props.cropBottom}%`);
const regionOverlayStyle = computed(() => {
  const box = previewImageBox.value;
  const top = box.top + box.height * (props.cropTop / 100);
  const height = box.height * ((props.cropBottom - props.cropTop) / 100);

  return {
    left: `${box.left}px`,
    top: `${top}px`,
    width: `${box.width}px`,
    height: `${height}px`,
    visibility: box.width && box.height ? "visible" : "hidden",
  };
});

const subtitleModel = computed({
  get: () => props.subtitleText,
  set: (value) => emit("update:subtitleText", value),
});

const translationModel = computed({
  get: () => props.translationText,
  set: (value) => emit("update:translationText", value),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function emitCropRegion(top, bottom) {
  let nextTop = Math.round(clamp(top, 0, 100 - MIN_REGION_HEIGHT));
  let nextBottom = Math.round(clamp(bottom, MIN_REGION_HEIGHT, 100));

  if (nextBottom < nextTop + MIN_REGION_HEIGHT)
    nextBottom = nextTop + MIN_REGION_HEIGHT;
  if (nextBottom > 100) {
    nextBottom = 100;
    nextTop = 100 - MIN_REGION_HEIGHT;
  }

  emit("update:cropTop", nextTop);
  emit("update:cropBottom", nextBottom);
}

function updatePreviewImageBox() {
  const media = previewMediaRef.value;
  const image = previewImageRef.value;
  const naturalWidth = image?.naturalWidth || props.currentFrame?.width || 0;
  const naturalHeight = image?.naturalHeight || props.currentFrame?.height || 0;

  if (!media || !naturalWidth || !naturalHeight) {
    previewImageBox.value = { left: 0, top: 0, width: 0, height: 0 };
    return;
  }

  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    previewImageBox.value = { left: 0, top: 0, width: 0, height: 0 };
    return;
  }

  const mediaRatio = rect.width / rect.height;
  const imageRatio = naturalWidth / naturalHeight;
  let width = rect.width;
  let height = rect.height;
  let left = 0;
  let top = 0;

  if (imageRatio > mediaRatio) {
    height = width / imageRatio;
    top = (rect.height - height) / 2;
  } else {
    width = height * imageRatio;
    left = (rect.width - width) / 2;
  }

  previewImageBox.value = { left, top, width, height };
}

function observePreviewMedia() {
  previewResizeObserver?.disconnect();
  previewResizeObserver = null;

  if (!previewMediaRef.value || typeof ResizeObserver === "undefined") return;

  previewResizeObserver = new ResizeObserver(updatePreviewImageBox);
  previewResizeObserver.observe(previewMediaRef.value);
}

function startRegionDrag(event, mode) {
  if (!props.currentFrame || props.busy || !previewMediaRef.value) return;

  updatePreviewImageBox();
  const box = previewImageBox.value;
  if (!box.height) return;

  event.preventDefault();
  regionDrag.value = {
    mode,
    startY: event.clientY,
    startTop: props.cropTop,
    startBottom: props.cropBottom,
    rectHeight: box.height,
  };
  window.addEventListener("pointermove", handleRegionPointerMove);
  window.addEventListener("pointerup", stopRegionDrag);
  window.addEventListener("pointercancel", stopRegionDrag);
}

function handleRegionPointerMove(event) {
  const drag = regionDrag.value;
  if (!drag) return;

  event.preventDefault();
  const delta = ((event.clientY - drag.startY) / drag.rectHeight) * 100;
  const startHeight = drag.startBottom - drag.startTop;

  if (drag.mode === "top") {
    const top = clamp(
      drag.startTop + delta,
      0,
      drag.startBottom - MIN_REGION_HEIGHT,
    );
    emitCropRegion(top, drag.startBottom);
    return;
  }

  if (drag.mode === "bottom") {
    const bottom = clamp(
      drag.startBottom + delta,
      drag.startTop + MIN_REGION_HEIGHT,
      100,
    );
    emitCropRegion(drag.startTop, bottom);
    return;
  }

  const top = clamp(drag.startTop + delta, 0, 100 - startHeight);
  emitCropRegion(top, top + startHeight);
}

function stopRegionDrag() {
  regionDrag.value = null;
  window.removeEventListener("pointermove", handleRegionPointerMove);
  window.removeEventListener("pointerup", stopRegionDrag);
  window.removeEventListener("pointercancel", stopRegionDrag);
}

watch(
  () => props.currentFrame?.previewUrl,
  async () => {
    await nextTick();
    observePreviewMedia();
    updatePreviewImageBox();
  },
  { immediate: true },
);

onMounted(() => {
  observePreviewMedia();
  updatePreviewImageBox();
  window.addEventListener("resize", updatePreviewImageBox);
});

onBeforeUnmount(() => {
  stopRegionDrag();
  previewResizeObserver?.disconnect();
  window.removeEventListener("resize", updatePreviewImageBox);
});

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

function hasImageTransferItem(items) {
  return Array.from(items || []).some(
    (item) =>
      item.kind === "file" && (!item.type || item.type.startsWith("image/")),
  );
}

function getImageFileFromItems(items) {
  for (const item of Array.from(items || [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

function getImageFileFromFiles(files) {
  return Array.from(files || []).find(isImageFile) || null;
}

function getImageFileNameExtension(type) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

function ensureNamedImageFile(file, prefix = "pasted-image") {
  if (file.name) return file;

  const extension = getImageFileNameExtension(file.type);
  return new File([file], `${prefix}-${Date.now()}.${extension}`, {
    type: file.type || "image/png",
    lastModified: file.lastModified || Date.now(),
  });
}

function emitImageFile(file, prefix) {
  if (!canImportImage.value || !file) return;
  emit("select-image", ensureNamedImageFile(file, prefix));
}

function chooseImage() {
  if (!canImportImage.value) return;
  imageInputRef.value?.click();
}

function handleImageChange(event) {
  emitImageFile(event.target.files?.[0], "selected-image");
  event.target.value = "";
}

function handleFrameDragover(event) {
  if (!canImportImage.value) return;

  if (
    hasImageTransferItem(event.dataTransfer?.items) ||
    getImageFileFromFiles(event.dataTransfer?.files)
  ) {
    isDraggingImage.value = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  } else if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "none";
  }
}

function handleFrameDragleave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  isDraggingImage.value = false;
}

function handleFrameDrop(event) {
  isDraggingImage.value = false;
  if (!canImportImage.value) return;

  const file =
    getImageFileFromFiles(event.dataTransfer?.files) ||
    getImageFileFromItems(event.dataTransfer?.items);
  if (file) {
    emitImageFile(file, "dropped-image");
  } else {
    emit("reject-image");
  }
}

function handleFramePaste(event) {
  if (!canImportImage.value) return;

  const file =
    getImageFileFromFiles(event.clipboardData?.files) ||
    getImageFileFromItems(event.clipboardData?.items);
  if (!file) return;

  event.preventDefault();
  emitImageFile(file, "pasted-image");
}

function normalizeLegacyMarkTags(value) {
  const source = String(value || "");
  return source.replace(
    /<mark>([\s\S]*?)<\/mark>/gi,
    (_, content) => `==${content}==`,
  );
}

function renderMarkdownSubtitle(value) {
  const source = normalizeLegacyMarkTags(value);
  return source.trim() ? markdownRenderer.render(source) : "";
}

defineExpose({
  getScratchCanvasElement: () => scratchCanvasRef.value,
});
</script>
