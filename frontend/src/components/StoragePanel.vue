<template>
  <ModulePanel class="storage-panel" :attention="attention">
    <div>
      <strong>保存目录</strong>
      <span>{{ storageLabel }}</span>
    </div>
    <el-button :icon="Download" :disabled="busy" @click="$emit('choose')">选择目录</el-button>
  </ModulePanel>
</template>

<script setup>
import { Download } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';

defineProps({
  storageLabel: {
    type: String,
    required: true
  },
  attention: {
    type: Boolean,
    default: false
  },
  busy: {
    type: Boolean,
    default: false
  }
});

defineEmits(['choose']);
</script>
