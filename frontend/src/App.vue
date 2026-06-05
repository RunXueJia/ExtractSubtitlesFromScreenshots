<template>
  <div class="app-shell">
    <aside class="source-panel">
      <BrandHeader />
      <SourceUploadPanel :source-name="sourceName" @select-source="handleSourceFile" @reject-source="showUnsupportedSource" />
      <StoragePanel
        :storage-status="storageStatus"
        :output-directory-name="outputDirectoryName"
        :storage-error="storageError"
        :busy="busy"
        @choose="chooseOutputDirectory"
      />
      <MediaViewerPanel
        ref="mediaViewerRef"
        :source-type="sourceType"
        :source-url="sourceUrl"
        :busy="busy"
        @capture="captureVideoFrame"
        @image-ready="handleImageReady"
        @image-error="handleImageError"
      />
      <HistoryPanel :history="history" :selected-id="selectedId" @select="selectFrame" @delete="deleteHistory" />
    </aside>

    <main class="workspace">
      <RecognitionResultPanel
        ref="resultPanelRef"
        v-model:crop-top="cropTop"
        v-model:crop-bottom="cropBottom"
        v-model:subtitle-text="subtitleText"
        v-model:translation-text="translationText"
        :current-frame="currentFrame"
        :download-url="currentFrame?.downloadUrl || ''"
        :download-file-name="currentFrame ? getFrameImageFileName(currentFrame) : ''"
        :show-image-actions="showImageFileActions"
        :ocr-status="ocrStatus"
        :translate-status="translateStatus"
        :busy="busy"
        @translate="translateCurrentText"
        @recognize="recognizeCurrentFrame"
        @select-image="handleFramePreviewImage"
        @reject-image="showUnsupportedSource"
        @save="saveCurrentText"
        @copy="copyCurrentFrame"
        @clear="clearCurrentFrame"
      />
    </main>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { ElMessage } from 'element-plus';

import { extractSubtitle, translateSubtitle } from './api/client.js';
import BrandHeader from './components/BrandHeader.vue';
import HistoryPanel from './components/HistoryPanel.vue';
import MediaViewerPanel from './components/MediaViewerPanel.vue';
import RecognitionResultPanel from './components/RecognitionResultPanel.vue';
import SourceUploadPanel from './components/SourceUploadPanel.vue';
import StoragePanel from './components/StoragePanel.vue';

const LEGACY_HISTORY_KEYS = ['extract-subtitles.history.v2', 'extract-subtitles.history.v1'];
const MAX_HISTORY = 20;
const HISTORY_PREVIEW_LENGTH = 80;
const STORAGE_DB_NAME = 'extract-subtitles-storage';
const STORAGE_DB_VERSION = 2;
const STORAGE_HANDLE_STORE_NAME = 'handles';
const STORAGE_HISTORY_STORE_NAME = 'history';
const OUTPUT_DIRECTORY_KEY = 'outputDirectory';
const HISTORY_INDEX_KEY = 'items';

const mediaViewerRef = ref(null);
const resultPanelRef = ref(null);

const outputDirectoryHandle = shallowRef(null);
const outputDirectoryName = ref('');
const storageStatus = ref('checking');
const storageError = ref('');
const sourceType = ref('');
const sourceName = ref('');
const sourceUrl = ref('');
const currentFrame = ref(null);
const selectedId = ref('');
const history = ref([]);
const busy = ref(false);
const cropTop = ref(80);
const cropBottom = ref(100);
const subtitleText = ref('');
const translationText = ref('');
const ocrStatus = ref('未识别');
const translateStatus = ref('待翻译');
const sessionCaptureReminderShown = ref(false);
const showImageFileActions = isHttpsOrLocalhostPage();

function isLocalhostHostname(hostname) {
  const value = String(hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]' || value.endsWith('.localhost');
}

function isHttpsOrLocalhostPage() {
  return window.location.protocol === 'https:' || isLocalhostHostname(window.location.hostname);
}

function readLegacyHistory() {
  for (const key of LEGACY_HISTORY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;
      return items.map(normalizeHistoryIndex).filter(Boolean).slice(0, MAX_HISTORY);
    } catch {
      return [];
    }
  }

  return [];
}

function clearLegacyHistory() {
  try {
    LEGACY_HISTORY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // Old localStorage indexes are best-effort migration only.
  }
}

async function loadHistoryIndex() {
  const stored = await readHistoryIndex();
  if (stored.length) {
    clearLegacyHistory();
    return stored;
  }

  const migrated = readLegacyHistory();
  if (migrated.length) await writeHistoryIndex(migrated);
  clearLegacyHistory();
  return migrated;
}

async function persistHistory() {
  try {
    await writeHistoryIndex(history.value.filter(item => item.storageMode !== 'session').slice(0, MAX_HISTORY));
  } catch {
    ElMessage.warning('浏览器本地索引保存失败。');
  }
}

function normalizeHistoryIndex(item) {
  if (!item || typeof item !== 'object' || !item.id || !item.sourceDirName || !item.imageFileName) return null;

  return {
    id: String(item.id),
    sourceType: item.sourceType === 'video' ? 'video' : 'image',
    sourceName: String(item.sourceName || '未命名素材'),
    sourceDirName: String(item.sourceDirName),
    imageFileName: String(item.imageFileName),
    textFileName: String(item.textFileName || `${item.id}.json`),
    seconds: Number.isFinite(item.seconds) ? item.seconds : 0,
    width: Number.isFinite(item.width) ? item.width : 0,
    height: Number.isFinite(item.height) ? item.height : 0,
    bytes: String(item.bytes || ''),
    textPreview: previewText(item.textPreview || item.text),
    translationPreview: previewText(item.translationPreview || item.translation),
    hasText: Boolean(item.hasText || item.textPreview || item.text),
    hasTranslation: Boolean(item.hasTranslation || item.translationPreview || item.translation),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString())
  };
}

function toHistoryIndex(item) {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    sourceDirName: item.sourceDirName,
    imageFileName: item.imageFileName,
    textFileName: item.textFileName,
    seconds: item.seconds,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    textPreview: previewText(item.text || item.textPreview),
    translationPreview: previewText(item.translation || item.translationPreview),
    hasText: Boolean(String(item.text || item.textPreview || '').trim()),
    hasTranslation: Boolean(String(item.translation || item.translationPreview || '').trim()),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function canPersistFrame() {
  return hasOutputDirectoryPermission();
}

function previewText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, HISTORY_PREVIEW_LENGTH);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function supportsFileSystemAccess() {
  return Boolean(window.isSecureContext && window.indexedDB && window.showDirectoryPicker);
}

function openStorageDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE_HANDLE_STORE_NAME)) db.createObjectStore(STORAGE_HANDLE_STORE_NAME);
      if (!db.objectStoreNames.contains(STORAGE_HISTORY_STORE_NAME)) db.createObjectStore(STORAGE_HISTORY_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('目录索引库打开失败。'));
  });
}

function runStorageTransaction(storeName, mode, run) {
  return openStorageDb().then(
    db =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = run(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('本地索引库操作失败。'));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error || new Error('本地索引库操作失败。'));
        };
      })
  );
}

async function readHistoryIndex() {
  const items = await runStorageTransaction(STORAGE_HISTORY_STORE_NAME, 'readonly', store => store.get(HISTORY_INDEX_KEY));
  if (!Array.isArray(items)) return [];
  return items.map(normalizeHistoryIndex).filter(Boolean).slice(0, MAX_HISTORY);
}

function writeHistoryIndex(items) {
  return runStorageTransaction(STORAGE_HISTORY_STORE_NAME, 'readwrite', store =>
    store.put(items.slice(0, MAX_HISTORY).map(toHistoryIndex), HISTORY_INDEX_KEY)
  );
}

async function readStoredDirectoryHandle() {
  return (await runStorageTransaction(STORAGE_HANDLE_STORE_NAME, 'readonly', store => store.get(OUTPUT_DIRECTORY_KEY))) || null;
}

async function storeDirectoryHandle(handle) {
  await runStorageTransaction(STORAGE_HANDLE_STORE_NAME, 'readwrite', store => store.put(handle, OUTPUT_DIRECTORY_KEY));
}

async function queryDirectoryPermission(handle) {
  if (!handle?.queryPermission) return 'granted';

  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

async function requestDirectoryPermission(handle) {
  if (!handle?.requestPermission) return 'granted';

  try {
    return await handle.requestPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

async function pickOutputDirectory() {
  const handle = await window.showDirectoryPicker({
    id: 'extract-subtitles-output',
    mode: 'readwrite'
  });

  await storeDirectoryHandle(handle);
  outputDirectoryHandle.value = handle;
  outputDirectoryName.value = handle.name || '';
  storageStatus.value = 'ready';
  storageError.value = '';
  return handle;
}

async function chooseOutputDirectory() {
  if (!supportsFileSystemAccess()) {
    storageStatus.value = 'unsupported';
    ElMessage.error('当前浏览器不支持选择本地目录，请使用 Chromium 系浏览器。');
    return;
  }

  try {
    const storedHandle = outputDirectoryHandle.value || (await readStoredDirectoryHandle());
    if (storedHandle) {
      outputDirectoryHandle.value = storedHandle;
      outputDirectoryName.value = storedHandle.name || '';
      const permission = await requestDirectoryPermission(storedHandle);
      if (permission === 'granted') {
        storageStatus.value = 'ready';
        storageError.value = '';
      } else {
        await pickOutputDirectory();
      }
    } else {
      await pickOutputDirectory();
    }

    await hydrateHistoryFromStorage();
    if (sourceType.value === 'image' && !currentFrame.value) await captureImagePreview();
    ElMessage.success('保存目录已设置');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    storageStatus.value = 'error';
    storageError.value = error?.message || '保存目录设置失败。';
    ElMessage.error(storageError.value);
  }
}

async function ensureOutputDirectory({ allowPicker = false } = {}) {
  if (!supportsFileSystemAccess()) {
    storageStatus.value = 'unsupported';
    throw new Error('当前浏览器不支持选择本地目录，请使用 Chromium 系浏览器。');
  }

  let handle = outputDirectoryHandle.value;
  if (!handle) {
    handle = await readStoredDirectoryHandle();
    if (handle) {
      outputDirectoryHandle.value = handle;
      outputDirectoryName.value = handle.name || '';
    }
  }

  if (!handle && allowPicker) handle = await pickOutputDirectory();
  if (!handle) {
    storageStatus.value = 'needs-setup';
    throw new Error('请先选择保存目录。');
  }

  let permission = await queryDirectoryPermission(handle);
  if (permission !== 'granted' && allowPicker) permission = await requestDirectoryPermission(handle);

  if (permission !== 'granted') {
    storageStatus.value = 'needs-permission';
    throw new Error('需要重新授权保存目录。');
  }

  storageStatus.value = 'ready';
  storageError.value = '';
  return handle;
}

function hasOutputDirectoryPermission() {
  return storageStatus.value === 'ready' && Boolean(outputDirectoryHandle.value);
}

function stripExtension(name) {
  const value = String(name || '').trim();
  const dotIndex = value.lastIndexOf('.');
  return dotIndex > 0 ? value.slice(0, dotIndex) : value;
}

function sanitizePathSegment(value, fallback) {
  let next = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
    .trim();

  if (!next) next = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(next)) next = `${next}_file`;
  return next;
}

function getSourceDirectoryName(name) {
  return sanitizePathSegment(stripExtension(name), 'untitled-source');
}

function createFrameId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `frame-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('无法生成截图文件。'));
    }, type, quality);
  });
}

function normalizeFrameImageBlob(blob) {
  if (blob.type === 'image/png') return blob;
  return new Blob([blob], { type: 'image/png' });
}

function getFrameImageFileName(frame) {
  return frame?.imageFileName || `${frame?.id || 'frame'}.png`;
}

function supportsNativeImageClipboard() {
  const ClipboardItemConstructor = window.ClipboardItem;
  if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItemConstructor === 'undefined') {
    return false;
  }
  return typeof ClipboardItemConstructor.supports !== 'function' || ClipboardItemConstructor.supports('image/png');
}

function createFrameDownloadUrl(blob) {
  return URL.createObjectURL(normalizeFrameImageBlob(blob));
}

async function copyImageWithClipboardApi(blob) {
  const ClipboardItemConstructor = window.ClipboardItem;
  const type = blob.type || 'image/png';
  if (!supportsNativeImageClipboard()) {
    return false;
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItemConstructor({
        [type]: blob
      })
    ]);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(directoryHandle, fileName, content) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(content);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort?.();
    } catch {
      // Ignore abort failures; the original write error is more useful.
    }
    throw error;
  }
}

async function getSourceDirectoryHandle(item, options = {}) {
  const rootHandle = await ensureOutputDirectory();
  return rootHandle.getDirectoryHandle(item.sourceDirName, options);
}

async function writeFrameSidecar(item) {
  if (item.storageMode === 'session') return;

  const directoryHandle = await getSourceDirectoryHandle(item, { create: true });
  const payload = {
    id: item.id,
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    seconds: item.seconds,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    imageFileName: item.imageFileName,
    text: item.text || '',
    translation: item.translation || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  await writeFile(
    directoryHandle,
    item.textFileName,
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );
}

async function loadFrameBlob(item) {
  if (item?.blob) return item.blob;

  const directoryHandle = await getSourceDirectoryHandle(item);
  const fileHandle = await directoryHandle.getFileHandle(item.imageFileName);
  return fileHandle.getFile();
}

async function loadFrameSidecar(item) {
  if (item?.storageMode === 'session') {
    return {
      text: item.text || '',
      translation: item.translation || ''
    };
  }

  const directoryHandle = await getSourceDirectoryHandle(item);
  const fileHandle = await directoryHandle.getFileHandle(item.textFileName);
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text());
}

function revokePreviewUrl(item) {
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (item?.downloadUrl && item.downloadUrl !== item.previewUrl && item.downloadUrl.startsWith('blob:')) {
    URL.revokeObjectURL(item.downloadUrl);
  }
}

async function hydrateFrameItem(item) {
  const next = { ...item };
  let blob = null;

  if (!next.previewUrl || !next.downloadUrl || !next.bytes) {
    blob = normalizeFrameImageBlob(await loadFrameBlob(next));
  }

  if (!next.previewUrl && blob) {
    next.previewUrl = URL.createObjectURL(blob);
  }
  if (!next.downloadUrl && blob) {
    next.downloadUrl = next.previewUrl || createFrameDownloadUrl(blob);
  }
  if (!next.bytes && blob) {
    next.bytes = formatBytes(blob.size);
  }
  if (next.storageMode === 'session' && blob) next.blob = blob;

  if ((next.hasText || next.hasTranslation) && (typeof next.text !== 'string' || typeof next.translation !== 'string')) {
    const sidecar = await loadFrameSidecar(next);
    next.text = sidecar.text || '';
    next.translation = sidecar.translation || '';
  }

  return next;
}

async function hydrateHistoryFromStorage() {
  const nextHistory = [];

  for (const item of history.value) {
    if (item.storageMode === 'session') {
      nextHistory.push(item);
      continue;
    }

    try {
      nextHistory.push(await hydrateFrameItem(item));
    } catch {
      nextHistory.push(item);
    }
  }

  history.value = nextHistory;
}

async function ensureCurrentFrameDownloadUrl() {
  const frame = currentFrame.value;
  if (!frame || frame.downloadUrl) return;

  try {
    const hydrated = await hydrateFrameItem(frame);
    if (currentFrame.value?.id !== frame.id) return;
    currentFrame.value = hydrated;
    history.value = history.value.map(item => (item.id === hydrated.id ? hydrated : item));
  } catch {
    // A missing download URL should not interrupt the rest of the page.
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

function getVideoElement() {
  return mediaViewerRef.value?.getVideoElement?.() || null;
}

function getImageElement() {
  return mediaViewerRef.value?.getImageElement?.() || null;
}

function getScratchCanvasElement() {
  return resultPanelRef.value?.getScratchCanvasElement?.() || null;
}

function handleSourceFile({ file, type }) {
  setSource(file, type);
}

function showUnsupportedSource() {
  ElMessage.warning('只支持视频或图片文件。');
}

function handleFramePreviewImage(file) {
  setSource(file, 'image');
}

function clearCurrentFrame() {
  currentFrame.value = null;
  selectedId.value = '';
  clearFrameText();
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
    const video = getVideoElement();
    if (!video) {
      ElMessage.error('视频预览尚未准备好。');
      return;
    }

    ElMessage.success('视频已载入');
    return;
  }
}

async function handleImageReady() {
  if (sourceType.value !== 'image') return;

  await captureImagePreview();
}

function handleImageError() {
  if (sourceType.value !== 'image') return;
  ElMessage.error('截图载入失败。');
}

async function createFrameItem(blob, meta = {}) {
  const imageBlob = normalizeFrameImageBlob(blob);
  const shouldPersist = canPersistFrame();
  const sourceDirName = getSourceDirectoryName(sourceName.value);
  const id = createFrameId();
  const imageFileName = `${id}.png`;
  const textFileName = `${id}.json`;
  const previewUrl = URL.createObjectURL(imageBlob);

  if (shouldPersist) {
    const rootHandle = await ensureOutputDirectory();
    const directoryHandle = await rootHandle.getDirectoryHandle(sourceDirName, { create: true });
    await writeFile(directoryHandle, imageFileName, imageBlob);
  }

  const item = {
    id,
    sourceType: sourceType.value,
    sourceName: sourceName.value || '未命名素材',
    sourceDirName,
    imageFileName,
    textFileName,
    storageMode: shouldPersist ? 'local' : 'session',
    blob: shouldPersist ? null : imageBlob,
    previewUrl,
    downloadUrl: previewUrl,
    seconds: meta.seconds || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    bytes: formatBytes(imageBlob.size),
    text: '',
    translation: '',
    createdAt: new Date().toISOString()
  };

  item.updatedAt = item.createdAt;
  if (shouldPersist) await writeFrameSidecar(item);

  currentFrame.value = item;
  selectedId.value = item.id;
  const nextHistory = [item, ...history.value.filter(entry => entry.id !== item.id)];
  nextHistory.slice(MAX_HISTORY).forEach(revokePreviewUrl);
  history.value = nextHistory.slice(0, MAX_HISTORY);
  if (shouldPersist) await persistHistory();
  clearFrameText();
  return item;
}

function showSessionCaptureReminder() {
  if (hasOutputDirectoryPermission() || sessionCaptureReminderShown.value) return;
  sessionCaptureReminderShown.value = true;
  ElMessage.warning('未选择保存目录，本次截帧只保留在当前窗口会话中，刷新后会丢失。');
}

async function captureVideoFrame() {
  const video = getVideoElement();
  if (!video?.videoWidth || !video?.videoHeight) {
    ElMessage.warning('视频尚未准备好。');
    return;
  }

  showSessionCaptureReminder();

  try {
    busy.value = true;
    const canvas = getScratchCanvasElement();
    if (!canvas) throw new Error('截图画布尚未准备好。');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/png');
    await createFrameItem(blob, {
      seconds: video.currentTime || 0,
      width: canvas.width,
      height: canvas.height
    });
    ElMessage.success('已截取当前帧');
  } catch (error) {
    ElMessage.error(error.message || '截取当前帧失败');
  } finally {
    busy.value = false;
  }
}

async function captureImagePreview() {
  const image = getImageElement();
  if (!image?.naturalWidth || !image?.naturalHeight) return;

  try {
    busy.value = true;
    const canvas = getScratchCanvasElement();
    if (!canvas) throw new Error('截图画布尚未准备好。');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/png');
    const item = await createFrameItem(blob, {
      width: canvas.width,
      height: canvas.height
    });
    ElMessage.success(item.storageMode === 'session' ? '截图已载入，本次会话有效' : '截图已保存');
  } catch (error) {
    ElMessage.error(error.message || '截图保存失败');
  } finally {
    busy.value = false;
  }
}

async function prepareSubtitleImage(frame) {
  const image = new Image();
  const blob = await loadFrameBlob(frame);
  const objectUrl = URL.createObjectURL(blob);
  image.src = objectUrl;
  await new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('截图文件读取失败。'));
    };
  });

  const cropX = Math.floor(image.naturalWidth * 0.08);
  const cropWidth = Math.floor(image.naturalWidth * 0.84);
  const cropY = Math.floor(image.naturalHeight * (cropTop.value / 100));
  const cropHeight = Math.max(1, Math.floor(image.naturalHeight * ((cropBottom.value - cropTop.value) / 100)));
  const scale = 3;

  const canvas = getScratchCanvasElement();
  if (!canvas) throw new Error('截图画布尚未准备好。');
  canvas.width = cropWidth * scale;
  canvas.height = cropHeight * scale;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

async function updateSelectedFrame(patch) {
  if (!currentFrame.value) return;
  const next = { ...currentFrame.value, ...patch, updatedAt: new Date().toISOString() };
  await writeFrameSidecar(next);
  currentFrame.value = next;
  history.value = history.value.map(item => (item.id === next.id ? next : item));
  if (next.storageMode !== 'session') await persistHistory();
}

async function selectFrame(item) {
  try {
    const hydrated = await hydrateFrameItem(item);
    currentFrame.value = hydrated;
    selectedId.value = hydrated.id;
    history.value = history.value.map(entry => (entry.id === hydrated.id ? hydrated : entry));
    subtitleText.value = hydrated.text || '';
    translationText.value = hydrated.translation || '';
    ocrStatus.value = hydrated.text ? '已保存' : '未识别';
    translateStatus.value = hydrated.translation ? '已翻译' : '待翻译';
  } catch (error) {
    currentFrame.value = item;
    selectedId.value = item.id;
    subtitleText.value = item.textPreview || '';
    translationText.value = item.translationPreview || '';
    ocrStatus.value = item.hasText ? '已保存' : '未识别';
    translateStatus.value = item.hasTranslation ? '已翻译' : '待翻译';
    ElMessage.warning(error.message || '历史截图读取失败，请重新授权目录。');
  }
}

async function deleteHistory(id) {
  const deleted = history.value.find(item => item.id === id);
  history.value = history.value.filter(item => item.id !== id);
  revokePreviewUrl(deleted);
  if (selectedId.value === id) {
    currentFrame.value = history.value[0] || null;
    if (currentFrame.value) await selectFrame(currentFrame.value);
    else {
      selectedId.value = '';
      clearFrameText();
    }
  }
  if (deleted?.storageMode !== 'session') await persistHistory();
}

async function recognizeCurrentFrame() {
  if (!currentFrame.value) return;
  const frameId = currentFrame.value.id;
  let shouldAutoTranslate = false;

  try {
    busy.value = true;
    ocrStatus.value = '识别中';
    translationText.value = '';
    translateStatus.value = '待翻译';
    const imageDataUrl = await prepareSubtitleImage(currentFrame.value);
    const text = (await extractSubtitle(imageDataUrl)).trim();
    if (currentFrame.value?.id !== frameId) return;
    subtitleText.value = text;
    ocrStatus.value = text ? '已识别' : '空结果';
    await updateSelectedFrame({ text, translation: '' });
    ElMessage.success('字幕识别完成');
    shouldAutoTranslate = Boolean(text);
  } catch (error) {
    ocrStatus.value = '识别失败';
    ElMessage.error(error.message || '字幕识别失败');
  } finally {
    busy.value = false;
  }

  if (shouldAutoTranslate && currentFrame.value?.id === frameId) {
    await translateCurrentText();
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
    await updateSelectedFrame({ text, translation });
    ElMessage.success('翻译已生成');
  } catch (error) {
    translateStatus.value = '翻译失败';
    ElMessage.error(error.message || '翻译失败');
  } finally {
    busy.value = false;
  }
}

async function saveCurrentText() {
  if (!currentFrame.value) return;
  try {
    await updateSelectedFrame({
      text: subtitleText.value.trim(),
      translation: translationText.value.trim()
    });
    ElMessage.success(currentFrame.value.storageMode === 'session' ? '文本已更新，本次会话有效' : '文本已保存');
  } catch (error) {
    ElMessage.error(error.message || '文本保存失败');
  }
}

async function copyCurrentFrame() {
  if (!currentFrame.value) return;

  try {
    if (!supportsNativeImageClipboard()) {
      ElMessage.warning('当前页面不支持直接复制图片，请在图片区域右击复制图片。');
      return;
    }

    const blob = normalizeFrameImageBlob(await loadFrameBlob(currentFrame.value));
    if (await copyImageWithClipboardApi(blob)) {
      ElMessage.success('图片已复制');
      return;
    }

    ElMessage.warning('复制失败，请在图片区域右击复制图片。');
  } catch (error) {
    ElMessage.error(error.message || '复制失败');
  }
}

onMounted(async () => {
  if (!supportsFileSystemAccess()) {
    storageStatus.value = 'unsupported';
    return;
  }

  try {
    history.value = await loadHistoryIndex();
    const handle = await readStoredDirectoryHandle();
    if (!handle) {
      storageStatus.value = 'needs-setup';
      return;
    }

    outputDirectoryHandle.value = handle;
    outputDirectoryName.value = handle.name || '';
    const permission = await queryDirectoryPermission(handle);
    storageStatus.value = permission === 'granted' ? 'ready' : 'needs-permission';
    if (permission === 'granted') {
      await hydrateHistoryFromStorage();
    }
  } catch (error) {
    storageStatus.value = 'error';
    storageError.value = error?.message || '保存目录读取失败。';
  }
});

watch(
  currentFrame,
  () => {
    void ensureCurrentFrameDownloadUrl();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  revokeSourceUrl();
  history.value.forEach(revokePreviewUrl);
});
</script>
