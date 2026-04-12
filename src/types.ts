
export enum NodeType {
  TEXT = 'Text',
  IMAGE = 'Image',
  VIDEO = 'Video',
  AUDIO = 'Audio',
  IMAGE_EDITOR = 'Image Editor',
  VIDEO_EDITOR = 'Video Editor',
  STORYBOARD = 'Storyboard Manager',
  CAMERA_ANGLE = 'Camera Angle',
  // Local open-source model nodes
  LOCAL_IMAGE_MODEL = 'Local Image Model',
  LOCAL_VIDEO_MODEL = 'Local Video Model'
}

export enum NodeStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export type ImageToolMode =
  | 'style'
  | 'mark'
  | 'focus'
  | 'multi-angle'
  | 'lighting'
  | 'grid'
  | 'enhance'
  | 'split'
  | null;

export interface ImageLightingSettings {
  mode: 'global' | 'local';
  smartMode: boolean;
  brightness: number;
  color: string;
  keyLight: 'left' | 'top' | 'right' | 'front' | 'bottom' | 'back';
  rimLight: boolean;
}

export interface FocusSelection {
  /** Normalized left offset within the rendered/source image, from 0 to 1. */
  x: number;
  /** Normalized top offset within the rendered/source image, from 0 to 1. */
  y: number;
  /** Normalized selection width, from 0 to 1. */
  width: number;
  /** Normalized selection height, from 0 to 1. */
  height: number;
}

export type ImageAnnotationType = 'reference' | 'note' | 'preserve' | 'ignore';

export interface ImageAnnotation {
  id: string;
  type: ImageAnnotationType;
  label: string;
  selection: FocusSelection;
}

export interface ImageCameraSettings {
  camera: string;
  lens: string;
  focalLengthMm: string;
  aperture: string;
}

export interface NodeData {
  id: string;
  type: NodeType;
  title?: string; // Custom title for the node (defaults to type if not set)
  x: number;
  y: number;
  prompt: string;
  status: NodeStatus;
  resultUrl?: string; // Image URL or Video URL
  lastFrame?: string; // For Video nodes: base64/url of the last frame to use as input for next node
  parentIds?: string[]; // For connecting lines (supports multiple inputs)
  groupId?: string; // ID of the group this node belongs to
  errorMessage?: string;

  // Text node specific
  textMode?: 'menu' | 'editing'; // For Text nodes: current mode
  linkedVideoNodeId?: string; // For Text nodes: linked video node for prompt sync

  // Video node specific
  videoMode?: 'standard' | 'frame-to-frame' | 'motion-control'; // Video generation mode
  frameInputs?: { nodeId: string; order: 'start' | 'end' }[]; // For frame-to-frame: connected image nodes
  videoModel?: string; // Video model version (e.g., 'veo-3.1', 'kling-v2-1')
  requestedVideoModel?: string; // The model the user selected before backend routing
  executedVideoModel?: string; // The model the backend actually executed
  executedVideoMode?: string; // The effective execution mode/tier the backend used
  executionProvider?: string; // The runtime provider actually used by the backend
  videoDuration?: number; // Video duration in seconds (e.g., 5, 6, 8, 10)
  generateAudio?: boolean; // Whether to generate native audio (Kling 2.6, Veo 3.1)
  inputUrl?: string; // Input URL for video generation (image-to-video)

  // Audio node specific
  audioModel?: string; // Voice model version (e.g., 'qwen3-tts-flash')

  // Video Editor specific
  trimStart?: number; // Trim start time in seconds
  trimEnd?: number; // Trim end time in seconds

  // Settings
  model: string;
  imageModel?: string; // Image model version (e.g., 'gemini-pro', 'kling-v2')
  imageCount?: number; // Image generation count
  aspectRatio: string;
  resolution: string;
  isPromptExpanded?: boolean; // Whether the prompt editing area is expanded
  resultAspectRatio?: string; // Actual aspect ratio of the generated image (e.g., '16/9')
  generationStartTime?: number; // Timestamp when generation started (for recovery race condition prevention)

  // Kling V1.5 Image Reference Settings
  klingReferenceMode?: 'subject' | 'face'; // Reference type for image-to-image
  klingFaceIntensity?: number; // Face reference intensity (0-100)
  klingSubjectIntensity?: number; // Subject reference intensity (0-100)
  detectedFaces?: { x: number; y: number; width: number; height: number }[]; // Detected face bounding boxes
  faceDetectionStatus?: 'idle' | 'loading' | 'success' | 'error'; // Face detection status

  // Image Editor state persistence
  editorElements?: Array<{
    id: string;
    type: 'arrow' | 'text';
    // Arrow properties
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    color?: string;
    lineWidth?: number;
    // Text properties
    x?: number;
    y?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
  }>; // Elements (arrows, text) drawn in image editor
  editorCanvasData?: string; // Base64 brush/eraser canvas data
  editorCanvasSize?: { width: number; height: number }; // Size of the canvas when elements were saved (for scaling)
  editorBackgroundUrl?: string; // Clean background image URL (without elements) for re-editing

  // Change Angle mode (Image nodes only)
  angleMode?: boolean; // Whether the node is in angle editing mode
  angleSettings?: {
    rotation: number;  // Horizontal rotation in degrees (-180 to 180)
    tilt: number;      // Vertical tilt in degrees (-90 to 90)
    scale: number;     // Scale factor (0 to 100)
    wideAngle: boolean; // Whether to use wide-angle lens perspective
  };
  imageToolMode?: ImageToolMode;
  imageToolAction?: string;
  imageCameraSettings?: ImageCameraSettings;
  imageLightingSettings?: ImageLightingSettings;
  focusSelection?: FocusSelection;
  activeImageAnnotationType?: ImageAnnotationType;
  imageAnnotations?: ImageAnnotation[];

  // Local Model node specific
  localModelId?: string;        // ID of the selected local model
  localModelPath?: string;      // Absolute path to model file on disk
  localModelType?: 'diffusion' | 'controlnet' | 'lora' | 'camera-control';
  localModelArchitecture?: string; // Model architecture (e.g., 'sd15', 'sdxl', 'qwen')

  // Storyboard Generator specific
  characterReferenceUrls?: string[]; // URLs of character images for reference in generation
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: 'global' | 'node-connector' | 'node-options' | 'add-nodes'; // 'global' = right click on canvas, 'add-nodes' = double click
  sourceNodeId?: string; // If 'node-connector' or 'node-options', which node originated the click
  connectorSide?: 'left' | 'right';
  sourceNodeType?: NodeType;
  dropCanvasPosition?: {
    x: number;
    y: number;
  };
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface SelectionBox {
  isActive: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface NodeGroup {
  id: string;
  nodeIds: string[];
  label: string;
  storyContext?: {
    story: string;
    scripts: any[];
    selectedCharacters?: any[]; // CharacterAsset[]
    sceneCount?: number;
    styleAnchor?: string;
    characterDNA?: Record<string, string>;
    compositeImageUrl?: string | null;
  };
}
