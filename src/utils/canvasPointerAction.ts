export type CanvasPointerAction = 'ignore' | 'select';

export function getCanvasPointerAction(event: Pick<PointerEvent, 'button'>): CanvasPointerAction {
  if (event.button === 0) return 'select';
  return 'ignore';
}
