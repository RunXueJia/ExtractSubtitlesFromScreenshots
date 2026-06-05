<template>
  <ModulePanel class="history-panel">
    <PanelTitle title="本地历史">
      <template #meta>
        <el-tag>{{ history.length }}</el-tag>
      </template>
    </PanelTitle>
    <el-empty v-if="!history.length" description="暂无历史" />
    <div v-else class="history-list">
      <div v-for="item in history" :key="item.id" class="history-row">
        <button class="history-item" :class="{ active: selectedId === item.id }" type="button" @click="$emit('select', item)">
          <img v-if="item.previewUrl" :src="item.previewUrl" alt="" />
          <span v-else class="history-thumb">PNG</span>
          <span>
            <strong>{{ item.sourceName }}</strong>
            <small>{{ getHistorySummary(item) }}</small>
          </span>
        </button>
        <el-button type="danger" plain @click="$emit('delete', item.id)">删除</el-button>
      </div>
    </div>
  </ModulePanel>
</template>

<script setup>
import ModulePanel from './ModulePanel.vue';
import PanelTitle from './PanelTitle.vue';

defineProps({
  history: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: ''
  }
});

defineEmits(['select', 'delete']);

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? seconds : 0;
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function getHistorySummary(item) {
  return item.text || item.translation || item.textPreview || item.translationPreview || formatTime(item.seconds);
}
</script>
