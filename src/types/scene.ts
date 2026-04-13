export const SCENES = {
  MULTI_VIEW_NINE_GRID: 'multi_view_nine_grid',
  PLOT_DEDUCTION_FOUR_GRID: 'plot_deduction_four_grid',
  COHERENT_STORYBOARD_25: 'coherent_storyboard_25',
  CINEMATIC_LIGHT_CORRECTION: 'cinematic_light_correction',
  CHARACTER_THREE_VIEW_GENERATE: 'character_three_view_generate',
  FRAME_DEDUCTION_PLUS_3S: 'frame_deduction_plus_3s',
  FRAME_DEDUCTION_MINUS_5S: 'frame_deduction_minus_5s',
  UPSCALE: 'upscale',
} as const;

export type SceneId = typeof SCENES[keyof typeof SCENES];
export type SceneTaskType = 'image' | 'video' | 'text' | 'audio';
export type SceneNodeType = 'tool' | 'storyboard' | 'image';

export type GenerationRequest = {
  params: Record<string, any>;
  metadata: {
    node_id: string;
    project_id: string;
  };
  provider: string;
  model: string;
  taskType: SceneTaskType;
  requestId: string;
};

export type SceneDefinition = {
  scene: SceneId;
  label: string;
  description?: string;
  icon?: string;
  taskType: SceneTaskType;
  nodeType: SceneNodeType;
  defaultParams: Record<string, any>;
};

export type StoryboardShot = {
  shotNumber: number;
  durationSeconds?: number;
  plotDescription: string;
  shotSize?: string;
  characterAction?: string;
  emotion?: string;
  sceneTags?: string;
  lightingAndAtmosphere?: string;
  dialogue?: string;
  audioEffects?: string;
  imageGenerationPrompt: string;
  videoMotionPrompt?: string;
  characters?: Array<{
    characterName: string;
    characterDescription?: string;
    characterImageUrl?: string;
  }>;
};

export type CharacterBible = {
  mainCharacters: Array<{
    id: string;
    name: string;
    appearance: string;
    outfit: string;
    temperament: string;
    referenceImages?: string[];
  }>;
};

export type WorldBible = {
  worldName?: string;
  era?: string;
  environmentStyle: string;
  colorPalette?: string[];
  recurringLocations?: string[];
};

export type FrameDeductionResult = {
  motionDelta: string;
  cameraDelta: string;
  environmentDelta: string;
  targetFramePrompt: string;
};

export type PipelineOutput = {
  textList?: string[];
  imageList?: Array<{ url: string; width?: number; height?: number; label?: string; status?: string }>;
  videoList?: Array<{ url: string; duration?: number }>;
  audioList?: Array<{ url: string; duration?: number }>;
  structuredData?: any;
};

export type PipelineContext = {
  nodeId: string;
  projectId: string;
  scene: SceneId;
  params: Record<string, any>;
};

export type PipelineHandleResult = {
  outputs: PipelineOutput;
  structuredData?: any;
};

export type ScenePipeline = {
  validate(input: Record<string, any>): Promise<void> | void;
  buildRequest(ctx: PipelineContext): Promise<GenerationRequest | GenerationRequest[]> | GenerationRequest | GenerationRequest[];
  handleResult(ctx: PipelineContext, result: PipelineOutput): Promise<PipelineHandleResult> | PipelineHandleResult;
};

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type TaskSnapshot = {
  taskId: string;
  requestId: string;
  status: TaskStatus;
  progressPercent: number;
  result?: PipelineOutput | null;
  errorMessage?: string | null;
  maxConcurrency?: number;
  childTasks?: Array<{
    taskId: string;
    index: number;
    status: TaskStatus;
    progressPercent: number;
    result?: PipelineOutput | null;
    errorMessage?: string | null;
  }>;
};
