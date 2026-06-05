<template>
  <ModulePanel class="region-panel">
    <PanelTitle title="字幕区域">
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
    <el-button type="primary" :icon="View" :loading="ocrStatus === '识别中'" :disabled="!currentFrame || busy" @click="$emit('recognize')">
      识别字幕
    </el-button>
  </ModulePanel>
</template>

<script setup>
import { computed } from 'vue';
import { View } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';
import PanelTitle from './PanelTitle.vue';

const props = defineProps({
  cropTop: {
    type: Number,
    required: true
  },
  cropBottom: {
    type: Number,
    required: true
  },
  currentFrame: {
    type: Object,
    default: null
  },
  busy: {
    type: Boolean,
    default: false
  },
  ocrStatus: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:cropTop', 'update:cropBottom', 'recognize']);

const regionLabel = computed(() => `${props.cropTop}% - ${props.cropBottom}%`);

function normalizeRegion(top, bottom) {
  if (bottom <= top + 8) return Math.min(100, top + 8);
  return bottom;
}

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
</script>
