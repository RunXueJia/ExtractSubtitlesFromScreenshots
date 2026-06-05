import './styles.css';
import { extractSubtitle, translateSubtitle } from './api/client.js';

const HISTORY_KEY = 'extract-subtitles.history.v1';
const MAX_HISTORY = 80;

const state = {
  sourceType: '',
  sourceName: '',
  frame: null,
  history: loadHistory(),
  selectedId: ''
};

const els = {
  videoInput: document.querySelector('#videoInput'),
  imageInput: document.querySelector('#imageInput'),
  pickVideo: document.querySelector('#pickVideo'),
  pickImage: document.querySelector('#pickImage'),
  dropZone: document.querySelector('#dropZone'),
  sourceName: document.querySelector('#sourceName'),
  video: document.querySelector('#video'),
  imagePreview: document.querySelector('#imagePreview'),
  mediaWrap: document.querySelector('#mediaWrap'),
  emptyState: document.querySelector('#emptyState'),
  captureFrame: document.querySelector('#captureFrame'),
  timeLabel: document.querySelector('#timeLabel'),
  cropTop: document.querySelector('#cropTop'),
  cropBottom: document.querySelector('#cropBottom'),
  regionLabel: document.querySelector('#regionLabel'),
  recognizeFrame: document.querySelector('#recognizeFrame'),
  frameMeta: document.querySelector('#frameMeta'),
  framePreview: document.querySelector('#framePreview'),
  scratchCanvas: document.querySelector('#scratchCanvas'),
  subtitleText: document.querySelector('#subtitleText'),
  translationText: document.querySelector('#translationText'),
  ocrStatus: document.querySelector('#ocrStatus'),
  translateStatus: document.querySelector('#translateStatus'),
  translateText: document.querySelector('#translateText'),
  saveText: document.querySelector('#saveText'),
  copyFrame: document.querySelector('#copyFrame'),
  downloadFrame: document.querySelector('#downloadFrame'),
  historyCount: document.querySelector('#historyCount'),
  historyList: document.querySelector('#historyList'),
  toast: document.querySelector('#toast')
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
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

function setSubtitleText(value) {
  els.subtitleText.dataset.rawText = value || '';
  els.subtitleText.innerHTML = renderMarkedSubtitle(value);
}

function getSubtitleText() {
  return els.subtitleText.dataset.rawText || els.subtitleText.innerText.trim();
}

function setBusy(isBusy, label = '') {
  els.recognizeFrame.disabled = isBusy || !state.frame;
  els.translateText.disabled = isBusy || !state.frame;
  els.saveText.disabled = isBusy || !state.frame;
  els.copyFrame.disabled = isBusy || !state.frame;
  els.downloadFrame.disabled = isBusy || !state.frame;
  els.captureFrame.disabled = isBusy || state.sourceType !== 'video';
  if (label) showToast(label);
}

function syncRegion() {
  let top = Number(els.cropTop.value);
  let bottom = Number(els.cropBottom.value);
  if (bottom <= top + 8) {
    bottom = Math.min(100, top + 8);
    els.cropBottom.value = String(bottom);
  }
  els.regionLabel.textContent = `${top}% - ${bottom}%`;
  return { top: top / 100, bottom: bottom / 100 };
}

function syncTimeline() {
  const current = els.video.currentTime || 0;
  const duration = Number.isFinite(els.video.duration) ? els.video.duration : 0;
  els.timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function setSource(file, type) {
  if (!file) return;
  state.sourceType = type;
  state.sourceName = file.name;
  state.frame = null;
  state.selectedId = '';
  const url = URL.createObjectURL(file);

  els.sourceName.textContent = file.name;
  els.mediaWrap.classList.add('has-source');
  els.emptyState.hidden = true;
  clearFrame();

  if (type === 'video') {
    els.imagePreview.removeAttribute('src');
    els.imagePreview.hidden = true;
    els.video.hidden = false;
    els.video.src = url;
    els.captureFrame.disabled = false;
    showToast('视频已载入');
    return;
  }

  els.video.removeAttribute('src');
  els.video.hidden = true;
  els.imagePreview.hidden = false;
  els.imagePreview.src = url;
  els.captureFrame.disabled = true;
  els.imagePreview.onload = () => {
    captureImagePreview();
    showToast('截图已载入');
  };
}

function clearFrame() {
  els.framePreview.removeAttribute('src');
  els.frameMeta.textContent = '尚无截帧';
  setSubtitleText('');
  els.translationText.value = '';
  els.ocrStatus.textContent = '未识别';
  els.translateStatus.textContent = '待翻译';
  setBusy(false);
}

function createFrameItem(dataUrl, meta = {}) {
  const item = {
    id: `frame-${Date.now()}`,
    sourceType: state.sourceType,
    sourceName: state.sourceName || '未命名素材',
    imageDataUrl: dataUrl,
    seconds: meta.seconds || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    bytes: formatBytesFromDataUrl(dataUrl),
    text: '',
    translation: '',
    createdAt: new Date().toISOString()
  };
  state.frame = item;
  state.selectedId = item.id;
  state.history = [item, ...state.history.filter(entry => entry.id !== item.id)].slice(0, MAX_HISTORY);
  persistHistory();
  selectFrame(item);
  renderHistory();
  return item;
}

function captureVideoFrame() {
  if (!els.video.videoWidth || !els.video.videoHeight) {
    showToast('视频尚未准备好。');
    return null;
  }

  const canvas = els.scratchCanvas;
  canvas.width = els.video.videoWidth;
  canvas.height = els.video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(els.video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  return createFrameItem(dataUrl, {
    seconds: els.video.currentTime || 0,
    width: canvas.width,
    height: canvas.height
  });
}

function captureImagePreview() {
  if (!els.imagePreview.naturalWidth || !els.imagePreview.naturalHeight) return null;
  const canvas = els.scratchCanvas;
  canvas.width = els.imagePreview.naturalWidth;
  canvas.height = els.imagePreview.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(els.imagePreview, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  return createFrameItem(dataUrl, {
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

  const region = syncRegion();
  const cropX = Math.floor(image.naturalWidth * 0.08);
  const cropWidth = Math.floor(image.naturalWidth * 0.84);
  const cropY = Math.floor(image.naturalHeight * region.top);
  const cropHeight = Math.max(1, Math.floor(image.naturalHeight * (region.bottom - region.top)));
  const scale = 3;

  const canvas = els.scratchCanvas;
  canvas.width = cropWidth * scale;
  canvas.height = cropHeight * scale;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function selectFrame(item) {
  state.frame = item;
  state.selectedId = item.id;
  els.framePreview.src = item.imageDataUrl;
  els.frameMeta.textContent = `${item.width} x ${item.height}${item.bytes ? ` · ${item.bytes}` : ''}`;
  setSubtitleText(item.text || '');
  els.translationText.value = item.translation || '';
  els.ocrStatus.textContent = item.text ? '已保存' : '未识别';
  els.translateStatus.textContent = item.translation ? '已翻译' : '待翻译';
  setBusy(false);
  renderHistory();
}

function updateSelectedFrame(patch) {
  if (!state.frame) return;
  const next = { ...state.frame, ...patch };
  state.frame = next;
  state.history = state.history.map(item => (item.id === next.id ? next : item));
  persistHistory();
  renderHistory();
}

function renderHistory() {
  els.historyCount.textContent = String(state.history.length);
  els.historyList.innerHTML = '';

  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '截取或导入截图后会出现在这里。';
    els.historyList.appendChild(empty);
    return;
  }

  for (const item of state.history) {
    const button = document.createElement('button');
    button.className = `history-item${state.selectedId === item.id ? ' active' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <img src="${item.imageDataUrl}" alt="">
      <span>
        <strong>${escapeHtml(item.sourceName)}</strong>
        <small>${escapeHtml(item.text || item.translation || formatTime(item.seconds))}</small>
      </span>
    `;
    button.addEventListener('click', () => selectFrame(item));

    const remove = document.createElement('button');
    remove.className = 'delete-history';
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', event => {
      event.stopPropagation();
      state.history = state.history.filter(entry => entry.id !== item.id);
      if (state.selectedId === item.id) {
        state.frame = null;
        state.selectedId = '';
        clearFrame();
      }
      persistHistory();
      renderHistory();
    });

    const row = document.createElement('div');
    row.className = 'history-row';
    row.append(button, remove);
    els.historyList.appendChild(row);
  }
}

async function recognizeCurrentFrame() {
  if (!state.frame) return;

  try {
    setBusy(true, '正在准备字幕区域...');
    els.ocrStatus.textContent = '上传中';
    const imageDataUrl = await prepareSubtitleImage(state.frame);
    els.ocrStatus.textContent = '识别中';
    const text = (await extractSubtitle(imageDataUrl)).trim();
    setSubtitleText(text);
    els.ocrStatus.textContent = text ? '已识别' : '空结果';
    updateSelectedFrame({ text });
    showToast('字幕识别完成');
  } catch (error) {
    els.ocrStatus.textContent = '识别失败';
    showToast(error.message || '字幕识别失败');
  } finally {
    setBusy(false);
  }
}

async function translateCurrentText() {
  if (!state.frame) return;
  const text = getSubtitleText();
  if (!text) {
    showToast('没有可翻译的字幕。');
    return;
  }

  try {
    setBusy(true);
    els.translateStatus.textContent = '翻译中';
    const translation = (await translateSubtitle(text)).trim();
    els.translationText.value = translation;
    els.translateStatus.textContent = translation ? '已翻译' : '空结果';
    updateSelectedFrame({ text, translation });
    showToast('翻译已生成');
  } catch (error) {
    els.translateStatus.textContent = '翻译失败';
    showToast(error.message || '翻译失败');
  } finally {
    setBusy(false);
  }
}

function saveCurrentText() {
  if (!state.frame) return;
  updateSelectedFrame({
    text: getSubtitleText(),
    translation: els.translationText.value.trim()
  });
  showToast('文本已保存到本地历史');
}

async function copyCurrentFrame() {
  if (!state.frame) return;

  try {
    const response = await fetch(state.frame.imageDataUrl);
    const blob = await response.blob();
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('当前浏览器不支持直接复制图片，请使用下载。');
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || 'image/png']: blob
      })
    ]);
    showToast('图片已复制');
  } catch (error) {
    showToast(error.message || '复制失败');
  }
}

function downloadCurrentFrame() {
  if (!state.frame) return;
  const link = document.createElement('a');
  link.href = state.frame.imageDataUrl;
  link.download = `${state.frame.id}.png`;
  link.click();
}

function installEvents() {
  els.pickVideo.addEventListener('click', () => els.videoInput.click());
  els.pickImage.addEventListener('click', () => els.imageInput.click());

  els.videoInput.addEventListener('change', () => setSource(els.videoInput.files[0], 'video'));
  els.imageInput.addEventListener('change', () => setSource(els.imageInput.files[0], 'image'));

  els.video.addEventListener('loadedmetadata', syncTimeline);
  els.video.addEventListener('timeupdate', syncTimeline);
  els.video.addEventListener('durationchange', syncTimeline);

  els.captureFrame.addEventListener('click', () => {
    const item = captureVideoFrame();
    if (item) showToast('已截取当前帧');
  });

  els.cropTop.addEventListener('input', syncRegion);
  els.cropBottom.addEventListener('input', syncRegion);
  els.recognizeFrame.addEventListener('click', recognizeCurrentFrame);
  els.translateText.addEventListener('click', translateCurrentText);
  els.saveText.addEventListener('click', saveCurrentText);
  els.copyFrame.addEventListener('click', copyCurrentFrame);
  els.downloadFrame.addEventListener('click', downloadCurrentFrame);

  els.subtitleText.addEventListener('input', () => {
    els.subtitleText.dataset.rawText = els.subtitleText.innerText.trim();
  });

  els.dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    els.dropZone.classList.add('drag-over');
  });

  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('drag-over');
  });

  els.dropZone.addEventListener('drop', event => {
    event.preventDefault();
    els.dropZone.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('video/')) setSource(file, 'video');
    else if (file.type.startsWith('image/')) setSource(file, 'image');
    else showToast('只支持视频或图片文件。');
  });

  document.addEventListener('keydown', event => {
    const target = event.target;
    const isEditing = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target.isContentEditable;
    if (isEditing) return;
    if (event.key === 'Enter' && state.sourceType === 'video') {
      event.preventDefault();
      captureVideoFrame();
    }
  });
}

syncRegion();
installEvents();
renderHistory();
if (state.history[0]) selectFrame(state.history[0]);
