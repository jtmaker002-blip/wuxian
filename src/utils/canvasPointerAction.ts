export type CanvasPointerAction = 'pan' | 'select';

export function getCanvasPointerAction(event: Pick<PointerEvent, 'button' | 'shiftKey'>): CanvasPointerAction {
  if (event.button === 0 && event.shiftKey) return 'select';
  return 'pan';
}
