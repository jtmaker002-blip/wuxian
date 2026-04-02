export function shouldRepairMissingVideoModel(
  currentVideoModel: string | undefined,
  registeredVideoModelIds: string[]
): boolean {
  if (!currentVideoModel) return true;
  if (currentVideoModel === 'tiktok-import') return false;
  return !registeredVideoModelIds.includes(currentVideoModel);
}
