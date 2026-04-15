import { NodeType } from '../../types';

export function shouldShowImageSuccessToolbar(options: {
  type: NodeType;
  scene?: string;
  showControls: boolean;
  isSuccess: boolean;
  resultUrl?: string;
}) {
  return (
    options.type === NodeType.IMAGE &&
    !options.scene &&
    options.showControls &&
    options.isSuccess &&
    Boolean(options.resultUrl)
  );
}
