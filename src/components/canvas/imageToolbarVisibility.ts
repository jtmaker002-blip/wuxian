import { NodeType } from '../../types';

export function shouldShowImageSuccessToolbar(options: {
  type: NodeType;
  scene?: string;
  showControls: boolean;
  isSuccess: boolean;
  resultUrl?: string;
}) {
  return (
    options.type !== NodeType.VIDEO &&
    options.type !== NodeType.LOCAL_VIDEO_MODEL &&
    options.type !== NodeType.AUDIO &&
    options.type !== NodeType.TEXT &&
    options.showControls &&
    options.isSuccess &&
    Boolean(options.resultUrl)
  );
}
