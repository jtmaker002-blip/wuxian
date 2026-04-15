import { describe, expect, it } from 'vitest';
import { buildSceneImagePrompts, buildStoryboardPlannerPrompt, getScenePromptTemplate } from './scenePromptTemplates.js';

describe('scenePromptTemplates', () => {
  it('builds a single production-sheet prompt for character three-view generation', () => {
    const [prompt] = buildSceneImagePrompts({
      scene: 'character_three_view_generate',
      params: {
        prompt: '参考图里的古风女性角色',
        style: 'realistic',
        background: 'plain white',
      },
      count: 1,
    });

    expect(prompt).toContain('single finished');
    expect(prompt).toContain('front view');
    expect(prompt).toContain('side profile view');
    expect(prompt).toContain('back view');
    expect(prompt).toContain('full-body');
    expect(prompt).toContain('same character');
    expect(prompt).toContain('white');
    expect(prompt).toContain('no text labels');
  });

  it('builds distinct camera prompts for the nine-grid workflow', () => {
    const prompts = buildSceneImagePrompts({
      scene: 'multi_view_nine_grid',
      params: { prompt: '同一人物站在香港街头' },
      count: 9,
    });

    expect(prompts).toHaveLength(9);
    expect(prompts[0]).toContain('front establishing wide');
    expect(prompts[4]).toContain('rear camera angle');
    expect(prompts[8]).toContain('macro/detail insert');
    expect(new Set(prompts).size).toBe(9);
  });

  it('keeps 25-grid prompts narrative-continuous instead of random variations', () => {
    const prompts = buildSceneImagePrompts({
      scene: 'coherent_storyboard_25',
      params: { storyText: '角色穿越雨夜街区' },
      count: 25,
    });

    expect(prompts).toHaveLength(25);
    expect(prompts[0]).toContain('Act: opening');
    expect(prompts[12]).toContain('Act: complication');
    expect(prompts[24]).toContain('Act: resolution');
    expect(prompts[10]).toContain('continuous 5x5 storyboard sequence');
  });

  it('uses scene-specific planner instructions for storyboard JSON', () => {
    const prompt = buildStoryboardPlannerPrompt({
      scene: 'plot_deduction_four_grid',
      count: 4,
      params: { storyText: '角色发现线索' },
    });

    expect(prompt).toContain('Plan four panels');
    expect(prompt).toContain('setup, discovery, choice, consequence');
    expect(prompt).toContain('"characterBible"');
  });

  it('keeps lighting as relighting rather than character redesign', () => {
    const prompt = getScenePromptTemplate('cinematic_light_correction', {
      keyLight: 'left',
      lightColor: 'warm amber',
      brightness: 70,
    });

    expect(prompt).toContain('relighting/correction');
    expect(prompt).toContain('preserve composition');
    expect(prompt).toContain('Do not redesign');
    expect(prompt).toContain('warm amber');
  });
});
