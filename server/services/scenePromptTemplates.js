const BASE_REFERENCE_RULES = [
  'Use every provided reference image as identity, costume, scene, composition, and style guidance.',
  'Preserve the main subject identity, clothing, face, hairstyle, props, and environment continuity unless the task explicitly asks to change them.',
  'Avoid watermarks, interface chrome, captions, random extra characters, duplicated limbs, distorted hands, and unreadable text.',
].join(' ');

const CAMERA_GRID_SHOTS = [
  ['01 front establishing wide', 'front-facing wide establishing shot, full environment visible, subject centered'],
  ['02 left three-quarter', 'left 3/4 camera angle, medium-wide framing, same pose continuity'],
  ['03 right three-quarter', 'right 3/4 camera angle, medium-wide framing, same pose continuity'],
  ['04 profile side', 'clean side-profile camera angle, same subject silhouette and wardrobe'],
  ['05 rear view', 'rear camera angle, readable back silhouette, same setting geometry'],
  ['06 low-angle hero', 'low-angle hero shot, slight upward lens perspective, cinematic depth'],
  ['07 high-angle overview', 'high-angle camera looking down, subject still recognizable'],
  ['08 close portrait', 'close-up portrait/detail shot, same lighting language and facial identity'],
  ['09 insert detail', 'macro/detail insert from the scene, object or costume detail that belongs to the same moment'],
];

function compact(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function listShots(shots) {
  return shots.map(([label, text]) => `${label}: ${text}`).join('\n');
}

function mergeUserIntent(params = {}) {
  return compact(params.prompt || params.storyText || params.userIntent, '保持参考图主体与画面设定，生成可直接用于 Liblib 画布的结果。');
}

function buildMultiViewPrompt(params = {}) {
  return [
    'Create nine coordinated panels for "多机位九宫格".',
    'All nine panels must describe the same exact subject and same scene at the same story moment, only changing camera position/lens/shot size.',
    'Generate nine separate images, one panel per image. When displayed together they should read as a clean 3 by 3 camera grid with consistent color grading, no UI labels, and no text overlays.',
    `Nine panels:\n${listShots(CAMERA_GRID_SHOTS)}`,
    `User intent: ${mergeUserIntent(params)}`,
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

function buildPlotFourPrompt(params = {}) {
  return [
    'Create one single 2x2 cinematic storyboard sheet for "剧情推演四宫格".',
    'The four panels must read as a short story: setup, discovery, choice, consequence. Keep character identity, costume, location, lighting logic, and visual style continuous.',
    'Each panel should be a finished cinematic image, not rough doodles. Use clear film composition, readable emotion, and progressive action.',
    `Story seed: ${compact(params.storyText || params.prompt, '一个角色发现隐藏线索并做出关键选择')}`,
    `Visual style: ${compact(params.visualStyle, 'cinematic realistic')}. Consistency level: ${compact(params.consistencyLevel, 'high')}.`,
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

function buildCoherent25Prompt(params = {}) {
  return [
    'Create one single 5x5 coherent storyboard contact sheet for "25宫格连贯分镜".',
    'It must be a continuous 25-shot short-film sequence, not random variations. Use a clear 5-act progression: opening, development, complication, climax, resolution.',
    'Keep the same main character bible, world bible, costume, environment rules, lens language, and color palette across every panel.',
    'Every panel should be a cinematic keyframe with strong composition and continuity. Avoid repeated identical frames, random character drift, unrelated scenes, text captions, and UI elements.',
    `Story seed: ${compact(params.storyText || params.prompt, '一段完整短片分镜：起因、发展、转折、高潮、结尾')}`,
    `Duration target: ${params.durationSeconds || 100} seconds. Visual style: ${compact(params.visualStyle, 'cinematic realistic')}.`,
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

function buildLightingPrompt(params = {}) {
  return [
    'Perform "电影级光影校正" on the provided image.',
    'This is a relighting/correction task: preserve composition, subject identity, facial features, clothing, pose, camera angle, background geometry, and object placement.',
    'Only improve cinematic light, shadow hierarchy, contrast, color temperature, depth, and rim separation. Do not redesign the character or scene.',
    `Key light: ${compact(params.keyLight, 'front')}. Brightness: ${params.brightness ?? 55}. Light color: ${compact(params.lightColor, 'neutral')}.`,
    `Rim light: ${params.rimLightEnabled === false ? 'disabled' : 'enabled'}${params.rimLightDirection ? `, direction ${params.rimLightDirection}` : ''}.`,
    params.referenceImage ? 'Use the extra reference image only for lighting mood and color grade, not for replacing the subject.' : '',
    `Extra user intent: ${mergeUserIntent(params)}`,
    BASE_REFERENCE_RULES,
  ].filter(Boolean).join('\n\n');
}

function buildThreeViewPrompt(params = {}) {
  return [
    'Create a single finished "角色三视图生成" character turnaround sheet.',
    'The output must be one image on a clean white or very light neutral background containing exactly three full-body views of the same character: front view, side profile view, and back view.',
    'The three figures must have identical face identity, hairstyle, hair ornaments, clothing layers, colors, fabric, props, height, body proportions, and silhouette. Use a neutral standing pose, arms slightly away from the body, feet visible, no cropping.',
    'Place the views left-to-right as front / side / back with even spacing, like a production character reference sheet. Use a neutral camera, minimal perspective distortion, and clear readable silhouette. No extra characters, no scenery, no heavy shadow, no text labels, no watermark.',
    'Each figure should fill most of the image height while keeping the full body visible from head to toe. The side view must be a true side profile, and the back view must clearly show the back of the costume and hair.',
    `Style: ${compact(params.style, 'realistic')}. Background: ${compact(params.background, 'plain white')}.`,
    `User intent: ${mergeUserIntent(params)}`,
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

function buildFrameDeductionPrompt(scene, params = {}) {
  const isFuture = scene === 'frame_deduction_plus_3s';
  return [
    `Create the ${isFuture ? 'future keyframe exactly 3 seconds later' : 'previous keyframe exactly 5 seconds earlier'} for "画面推演".`,
    'This is temporal inference from the provided image. Keep the same character identity, costume, location, camera lens language, color grade, and cinematic continuity.',
    isFuture
      ? 'Advance the action naturally: subtle body motion, camera movement, environmental changes, and cause/effect should feel like the next moment in the same shot.'
      : 'Reverse the action naturally: infer what the shot looked like five seconds before, with earlier pose, camera position, and environmental state.',
    'Output one polished cinematic frame, not a storyboard sheet. Avoid arbitrary scene changes, new outfits, new people, or unrelated camera angles.',
    `User intent: ${mergeUserIntent(params)}`,
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

function buildUpscalePrompt(params = {}) {
  return [
    'Perform "高清放大" on the provided image.',
    'Preserve the exact image content, framing, identity, composition, colors, and style. Do not invent new scene elements.',
    `Target resolution: ${compact(params.targetResolution, '2x')}. Detail mode: ${compact(params.detailMode, 'cinematic')}.`,
    'Improve clarity, texture, edge definition, fine detail, and compression artifacts while keeping the result natural.',
    BASE_REFERENCE_RULES,
  ].join('\n\n');
}

export function getScenePromptTemplate(scene, params = {}) {
  switch (scene) {
    case 'multi_view_nine_grid':
      return buildMultiViewPrompt(params);
    case 'plot_deduction_four_grid':
      return buildPlotFourPrompt(params);
    case 'coherent_storyboard_25':
      return buildCoherent25Prompt(params);
    case 'cinematic_light_correction':
      return buildLightingPrompt(params);
    case 'character_three_view_generate':
      return buildThreeViewPrompt(params);
    case 'frame_deduction_plus_3s':
    case 'frame_deduction_minus_5s':
      return buildFrameDeductionPrompt(scene, params);
    case 'upscale':
      return buildUpscalePrompt(params);
    default:
      return [mergeUserIntent(params), BASE_REFERENCE_RULES].join('\n\n');
  }
}

export function buildSceneImagePrompts({ scene, params = {}, count = 1, storyboard = [] }) {
  const template = getScenePromptTemplate(scene, params);
  if (scene === 'character_three_view_generate') return [template];

  if (scene === 'multi_view_nine_grid') {
    return CAMERA_GRID_SHOTS.slice(0, count).map(([label, shot], index) => {
      const plannedShot = Array.isArray(storyboard) ? storyboard[index] : undefined;
      return [
        `Generate panel ${label} for "多机位九宫格".`,
        shot,
        'Generate one standalone image for this tile of a 3x3 camera grid. Keep the same exact subject, same moment, same environment, same costume, and same color grade as every other tile.',
        plannedShot?.plotDescription ? `Planned continuity beat: ${plannedShot.plotDescription}` : '',
        plannedShot?.lightingAndAtmosphere ? `Shared lighting plan: ${plannedShot.lightingAndAtmosphere}` : '',
        `User intent: ${mergeUserIntent(params)}`,
        BASE_REFERENCE_RULES,
      ].filter(Boolean).join('\n\n');
    });
  }

  if (Array.isArray(storyboard) && storyboard.length > 0) {
    return storyboard.slice(0, count).map((shot, index) => [
      shot.imageGenerationPrompt || shot.plotDescription || `Shot ${index + 1}`,
      `Shot number: ${shot.shotNumber || index + 1}`,
      shot.characterAction ? `Character action: ${shot.characterAction}` : '',
      shot.lightingAndAtmosphere ? `Lighting: ${shot.lightingAndAtmosphere}` : '',
      BASE_REFERENCE_RULES,
    ].filter(Boolean).join('\n\n'));
  }

  if (scene === 'plot_deduction_four_grid') {
    const beats = ['setup / 起', 'discovery / 承', 'choice / 转', 'consequence / 合'];
    return Array.from({ length: count }).map((_, index) => [
      `Generate panel ${index + 1} (${beats[index] || `beat ${index + 1}`}) for "剧情推演四宫格".`,
      'Keep the same character identity, costume, setting, lighting logic, and film style. This panel must connect naturally with the other three panels.',
      `Story seed: ${compact(params.storyText || params.prompt, '一个角色发现隐藏线索并做出关键选择')}`,
      BASE_REFERENCE_RULES,
    ].join('\n\n'));
  }

  if (scene === 'coherent_storyboard_25') {
    return Array.from({ length: count }).map((_, index) => {
      const act = index < 5 ? 'opening' : index < 10 ? 'development' : index < 15 ? 'complication' : index < 20 ? 'climax' : 'resolution';
      return [
        `Generate shot ${index + 1} of 25 for "25宫格连贯分镜". Act: ${act}.`,
        'This is one frame in a continuous 5x5 storyboard sequence. Preserve the same character bible, world bible, costume, setting, lens language, and color palette.',
        'Make this shot visually distinct but narratively continuous with the previous and next shots.',
        `Story seed: ${compact(params.storyText || params.prompt, '一段完整短片分镜：起因、发展、转折、高潮、结尾')}`,
        BASE_REFERENCE_RULES,
      ].join('\n\n');
    });
  }

  return Array.from({ length: count }).map((_, index) => (
    count === 1 ? template : `${template}\n\nPanel ${index + 1} of ${count}.`
  ));
}

export function buildStoryboardPlannerPrompt({ scene, count, params = {} }) {
  const baseIntent = mergeUserIntent(params);
  const sceneRules = {
    multi_view_nine_grid: 'Plan a continuity anchor for nine separate multi-camera panels. Keep all panels as the same moment from the fixed nine camera angles.',
    plot_deduction_four_grid: 'Plan four panels: setup, discovery, choice, consequence.',
    coherent_storyboard_25: 'Plan 25 continuous shots with character/world bibles and a 5-act progression.',
  }[scene] || 'Plan a cinematic image sequence.';

  return `Return only valid JSON for a Liblib-style cinematic generation pipeline.
Scene: ${scene}
Count: ${count}
Intent: ${baseIntent}
Scene rules: ${sceneRules}
Continuity rules: ${BASE_REFERENCE_RULES}
Required shape:
{
  "styleAnchor": "string",
  "characterBible": {"mainCharacters": [{"id":"hero","name":"主角","appearance":"string","outfit":"string","temperament":"string"}]},
  "worldBible": {"worldName":"string","environmentStyle":"string","colorPalette":["string"],"recurringLocations":["string"]},
  "storyboard": [
    {"shotNumber":1,"durationSeconds":4,"plotDescription":"string","shotSize":"string","characterAction":"string","emotion":"string","sceneTags":"string","lightingAndAtmosphere":"string","imageGenerationPrompt":"string","videoMotionPrompt":"string"}
  ]
}`;
}
