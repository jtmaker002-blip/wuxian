export interface LiblibImageReferenceNode {
  id: string;
  url?: string;
}

export interface LiblibImageReferenceState {
  count: number;
  hasReference: boolean;
  previewUrl?: string;
}

export function getLiblibImageReferenceState({
  connectedImageNodes = [],
  inputUrl,
  resultUrl,
}: {
  connectedImageNodes?: LiblibImageReferenceNode[];
  inputUrl?: string;
  resultUrl?: string;
}): LiblibImageReferenceState {
  const directPreviewUrl = inputUrl || resultUrl;
  const connectedPreviewUrl = connectedImageNodes.find((node) => Boolean(node.url))?.url;
  const previewUrl = directPreviewUrl || connectedPreviewUrl;
  const count = connectedImageNodes.length > 0 ? connectedImageNodes.length : previewUrl ? 1 : 0;

  return {
    count,
    hasReference: count > 0 || Boolean(previewUrl),
    previewUrl,
  };
}

export function getLiblibBlankImageNodeState({
  selected,
  isImageType,
  isLocalModel,
  hasUploadHandler,
}: {
  selected: boolean;
  isImageType: boolean;
  isLocalModel: boolean;
  hasUploadHandler: boolean;
}) {
  const isHostedImageNode = isImageType && !isLocalModel;
  const isSelectedHostedImageNode = selected && isHostedImageNode;

  return {
    headline: isSelectedHostedImageNode ? null : undefined,
    showMutedIcon: isSelectedHostedImageNode,
    showSelectedBlankFrame: isSelectedHostedImageNode,
    showSelectedUploadCta: isSelectedHostedImageNode && hasUploadHandler,
  };
}
