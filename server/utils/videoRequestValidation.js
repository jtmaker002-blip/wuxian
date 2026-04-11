import { assertVideoExecutionSupported, resolveVideoExecutionPlan } from './videoProviderRouting.js';

const SUPPORTED_WAN_FAL_MODELS = new Set(['wan2.6-i2v', 'wan2.6-i2v-flash']);
const SUPPORTED_SEEDANCE_FRAME_MODELS = new Set(['jimeng-seedance-2', 'jimeng-4.5']);
const SUPPORTED_SEEDANCE_AUDIO_MODELS = new Set([
  'jimeng-seedance-2',
  'jimeng-4.5',
  'jimeng-4.1',
  'jimeng-4.0',
  'jimeng-video-3-fast',
]);
const SUPPORTED_SEEDANCE_ASPECT_RATIOS = new Set(['16:9', '9:16']);
const SUPPORTED_SEEDANCE_DURATIONS = new Set([5, 10]);

export function validateVideoRequest({
  videoModel,
  imageBase64,
  referenceImagesBase64,
  lastFrameBase64,
  motionReferenceUrl,
  duration,
  aspectRatio,
  resolution,
  generateAudio,
}) {
  const model = String(videoModel || '');
  const hasStartFrame = Boolean(imageBase64);
  const hasReferenceImages = Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0;
  const hasEndFrame = Boolean(lastFrameBase64);
  const hasMotionReference = Boolean(motionReferenceUrl);
  const seconds = Number(duration || 0);
  const { provider, normalizedModel, executionMode } = resolveVideoExecutionPlan({
    modelId: model,
    imageBase64,
    referenceImagesBase64,
    lastFrameBase64,
    motionReferenceUrl,
  });
  const isKlingModel = provider === 'kling';
  const isKling26 = normalizedModel === 'kling-v2-6';
  const isHailuoModel = provider === 'hailuo';
  const isVeoLikeModel = provider === 'veo';
  const isSoraModel = provider === 'openai-video';
  const isGrokModel = provider === 'xai-video';
  const isWanModel = provider === 'wan' && SUPPORTED_WAN_FAL_MODELS.has(normalizedModel);
  const isSeedanceModel = provider === 'seedance';

  if (hasEndFrame && !hasStartFrame) {
    throw new Error('首尾帧模式必须同时提供首帧与尾帧');
  }

  if (hasMotionReference && !isKling26) {
    throw new Error('运动参考目前只支持 Kling 2.6');
  }

  if (isHailuoModel && hasStartFrame && hasReferenceImages) {
    throw new Error('Hailuo 当前不能同时混用首帧图生和参考图模式');
  }

  if (isWanModel && !hasStartFrame) {
    throw new Error('Wan 图生视频必须提供首帧图片');
  }

  if (isWanModel && hasEndFrame) {
    throw new Error('Wan 图生视频当前不支持首尾帧模式');
  }

  if (isWanModel && hasMotionReference) {
    throw new Error('Wan 图生视频当前不支持运动参考模式');
  }

  if (hasMotionReference && hasEndFrame) {
    throw new Error('运动参考模式不能与首尾帧模式混用');
  }

  if (hasMotionReference && !hasStartFrame) {
    throw new Error('运动参考模式必须同时提供角色图像');
  }

  if (isGrokModel && hasEndFrame) {
    throw new Error('Grok Video 3 当前不支持首尾帧模式');
  }

  if (isGrokModel && hasMotionReference) {
    throw new Error('Grok Video 3 当前不支持运动参考模式');
  }

  if (isGrokModel && hasStartFrame && hasReferenceImages) {
    throw new Error('Grok Video 3 当前不能同时使用首帧图片和多图参考');
  }

  if (isGrokModel && hasReferenceImages) {
    throw new Error('Grok Video 3 当前不支持多图/全图参考，请仅使用单图 image 输入');
  }

  if (isSoraModel && hasEndFrame) {
    throw new Error('Sora 2 当前不支持首尾帧模式');
  }

  if (hasReferenceImages && !isGrokModel && !isHailuoModel) {
    throw new Error('当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。');
  }

  if (isSeedanceModel && hasMotionReference) {
    throw new Error('即梦视频模型当前不支持运动参考模式');
  }

  if (isSeedanceModel && hasReferenceImages) {
    throw new Error('即梦视频模型当前不支持标准模式的多图/全图参考');
  }

  if (isSeedanceModel && hasEndFrame && !SUPPORTED_SEEDANCE_FRAME_MODELS.has(normalizedModel)) {
    throw new Error(`${normalizedModel} 当前后端尚未接通首尾帧模式`);
  }

  if (isSeedanceModel && seconds && !SUPPORTED_SEEDANCE_DURATIONS.has(seconds)) {
    throw new Error('即梦视频模型当前仅支持 5 或 10 秒');
  }

  if (isSeedanceModel && resolution && !['720p', '1080p'].includes(resolution)) {
    throw new Error('即梦视频模型当前仅支持 720p 或 1080p');
  }

  if (isSeedanceModel && aspectRatio && !SUPPORTED_SEEDANCE_ASPECT_RATIOS.has(aspectRatio)) {
    throw new Error('即梦视频模型当前仅支持 16:9 或 9:16');
  }

  if (isKlingModel && seconds && ![5, 10].includes(seconds)) {
    throw new Error('Kling 视频目前仅支持 5 或 10 秒');
  }

  if (isHailuoModel && seconds && ![6, 10].includes(seconds)) {
    throw new Error('Hailuo 视频目前仅支持 6 或 10 秒');
  }

  if (isVeoLikeModel && seconds && ![4, 6, 8].includes(seconds)) {
    throw new Error('Veo 路线视频目前仅支持 4、6 或 8 秒');
  }

  if (isSoraModel && seconds && ![4, 8, 12].includes(seconds)) {
    throw new Error('Sora 2 当前仅支持 4、8 或 12 秒');
  }

  if (isWanModel && seconds && ![5, 10, 15].includes(seconds)) {
    throw new Error('Wan 图生视频当前仅支持 5、10 或 15 秒');
  }

  if (isGrokModel && seconds && (seconds < 1 || seconds > 15)) {
    throw new Error('Grok Video 3 当前仅支持 1 到 15 秒');
  }

  if (isKling26 && resolution && !['Auto'].includes(resolution)) {
    throw new Error('Kling 2.6 当前仅支持 Auto 分辨率');
  }

  if (isKlingModel && !isKling26 && resolution && !['Auto', '720p', '1080p'].includes(resolution)) {
    throw new Error('Kling 视频目前仅支持 Auto、720p 或 1080p');
  }

  if (isKling26 && hasEndFrame && aspectRatio && !['16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Kling 2.6 首尾帧当前仅支持 16:9 或 9:16');
  }

  if (isKling26 && !hasEndFrame && aspectRatio && !['1:1', '16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Kling 2.6 当前仅支持 1:1、16:9 或 9:16');
  }

  if (isKlingModel && !isKling26 && aspectRatio && !['16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Kling 视频目前仅支持 16:9 或 9:16');
  }

  if (isHailuoModel && resolution && !['768p', '1080p'].includes(resolution)) {
    throw new Error('Hailuo 视频目前仅支持 768p 或 1080p');
  }

  if (isHailuoModel && aspectRatio && !['16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Hailuo 视频目前仅支持 16:9 或 9:16');
  }

  if (isVeoLikeModel && resolution && !['512p', '720p', '1080p'].includes(resolution)) {
    throw new Error('Veo 路线视频目前仅支持 512p、720p 或 1080p');
  }

  if (isVeoLikeModel && aspectRatio && !['16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Veo 路线视频目前仅支持 16:9 或 9:16');
  }

  if (isSoraModel && aspectRatio && !['16:9', '9:16'].includes(aspectRatio)) {
    throw new Error('Sora 2 当前仅支持 16:9 或 9:16');
  }

  if (isSoraModel && resolution && !['720p', '1080p'].includes(resolution)) {
    throw new Error('Sora 2 当前仅支持 720p 或 1080p');
  }

  if (isWanModel && resolution && !['720p', '1080p'].includes(resolution)) {
    throw new Error('Wan 图生视频当前仅支持 720p 或 1080p');
  }

  if (isWanModel && aspectRatio && !['Auto'].includes(aspectRatio)) {
    throw new Error('Wan 图生视频当前沿用首帧原图比例，请保持比例为 Auto');
  }

  if (isGrokModel && resolution && !['480p', '720p'].includes(resolution)) {
    throw new Error('Grok Video 3 当前仅支持 480p 或 720p');
  }

  if (isGrokModel && aspectRatio && !['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'].includes(aspectRatio)) {
    throw new Error('Grok Video 3 当前仅支持 1:1、16:9、9:16、4:3、3:4、3:2 或 2:3');
  }

  if (generateAudio && !isKling26 && !(isSeedanceModel && SUPPORTED_SEEDANCE_AUDIO_MODELS.has(normalizedModel))) {
    throw new Error('当前模型暂不支持音频生成');
  }

  if (isKling26 && executionMode === 'motion-control' && generateAudio) {
    throw new Error('Kling 2.6 运动参考模式当前不支持音频生成');
  }

  if (isSeedanceModel && generateAudio && executionMode === 'motion-control') {
    throw new Error('即梦视频模型当前不支持运动参考模式');
  }

  assertVideoExecutionSupported({ provider, normalizedModel, executionMode });
}
