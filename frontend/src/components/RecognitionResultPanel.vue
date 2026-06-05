<template>
  <ModulePanel class="result-panel">
    <PanelTitle title="截帧预览">
      <template #meta>
        <el-tag type="info">{{ frameMeta }}</el-tag>
      </template>
    </PanelTitle>
    <div class="frame-grid">
      <div class="frame-preview">
        <template v-if="currentFrame?.previewUrl">
          <img class="frame-preview-bg" :src="currentFrame.previewUrl" alt="" aria-hidden="true" />
          <img class="frame-preview-image" :src="currentFrame.previewUrl" alt="" />
        </template>
        <el-empty v-else-if="currentFrame" description="需要重新授权目录" />
        <el-empty v-else description="暂无截帧" />
        <canvas ref="scratchCanvasRef" hidden></canvas>
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
import { CopyDocument, DocumentChecked, Download, Switch } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';
import PanelTitle from './PanelTitle.vue';

const props = defineProps({
  currentFrame: {
    type: Object,
    default: null
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
  'update:subtitleText',
  'update:translationText',
  'translate',
  'save',
  'copy',
  'download'
]);

const scratchCanvasRef = ref(null);

const frameMeta = computed(() => {
  const frame = props.currentFrame;
  if (!frame) return '尚无截帧';
  return `${frame.width} x ${frame.height}${frame.bytes ? ` · ${frame.bytes}` : ''}`;
});

const markedSubtitleHtml = computed(() => renderMarkedSubtitle(props.subtitleText));
const ocrTagType = computed(() => (props.ocrStatus.includes('失败') ? 'danger' : props.ocrStatus.includes('已') ? 'success' : 'info'));
const translateTagType = computed(() =>
  props.translateStatus.includes('失败') ? 'danger' : props.translateStatus.includes('已') ? 'success' : 'info'
);

const subtitleModel = computed({
  get: () => props.subtitleText,
  set: value => emit('update:subtitleText', value)
});

const translationModel = computed({
  get: () => props.translationText,
  set: value => emit('update:translationText', value)
});

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
