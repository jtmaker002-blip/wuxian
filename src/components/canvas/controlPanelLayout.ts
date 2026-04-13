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
  if (isVideoNode) return 'w-[min(760px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
  if (isImageToVideoNode) return 'w-[min(520px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
  return 'w-[min(600px,calc(100vw-32px))] max-w-[calc(100vw-32px)]';
}
