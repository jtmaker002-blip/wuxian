export function getControlPanelWidthClassName({
  isLiblibImageNode,
  isVideoNode,
  isImageToVideoNode,
}: {
  isLiblibImageNode: boolean;
  isVideoNode: boolean;
  isImageToVideoNode: boolean;
}) {
  if (isLiblibImageNode) return 'w-[min(620px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
  if (isVideoNode) return 'w-[min(680px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
  if (isImageToVideoNode) return 'w-[min(520px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
  return 'w-[min(600px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
}

export function getControlPanelScale(zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(3.2, Math.max(0.42, 1 / zoom));
}
