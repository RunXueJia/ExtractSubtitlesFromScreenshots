<template>
  <ModulePanel class="storage-panel" :attention="needsSetup">
    <div>
      <strong>保存目录</strong>
      <span>{{ storageLabel }}</span>
    </div>
    <el-button :icon="Download" :disabled="busy" @click="$emit('choose')">选择目录</el-button>
  </ModulePanel>
</template>

<script setup>
import { computed } from 'vue';
import { Download } from '@element-plus/icons-vue';

import ModulePanel from './ModulePanel.vue';

const props = defineProps({
  storageStatus: {
    type: String,
    required: true
  },
  outputDirectoryName: {
    type: String,
    default: ''
  },
  storageError: {
    type: String,
    default: ''
  },
  busy: {
    type: Boolean,
    default: false
  }
});

defineEmits(['choose']);

const needsSetup = computed(() => props.storageStatus !== 'ready');

const storageLabel = computed(() => {
  if (props.storageStatus === 'checking') return '正在检查目录授权';
  if (props.storageStatus === 'ready') return props.outputDirectoryName ? `已连接 ${props.outputDirectoryName}` : '已连接';
  if (props.storageStatus === 'unsupported') return '当前浏览器不支持目录保存';
  if (props.storageStatus === 'needs-permission') return '需要重新授权保存目录';
  if (props.storageStatus === 'error') return props.storageError || '目录不可用';
  return '首次使用请选择保存目录';
});
</script>
