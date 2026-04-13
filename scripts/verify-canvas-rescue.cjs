const fs = require('fs');
const path = require('path');

const root = process.cwd();

const checks = [
  ['docs/current-status.md', 'Completed Grid Item Operations'],
  ['docs/final-gap-checklist.md', 'Project-level TypeScript diagnostics are clean'],
  ['src/types/project.ts', 'export type Project'],
  ['src/types/project.ts', 'export type CanvasEdge'],
  ['src/types/project.ts', 'export type GridImageItem'],
  ['src/services/scenes/registry.ts', 'SCENE_DEFINITIONS'],
  ['src/services/pipelines/registry.ts', 'pipelineRegistry'],
  ['src/services/pipelines/scenes/gridSplitPipeline.ts', 'gridSplitPipeline'],
  ['src/services/pipelines/scenes/plotDeductionFourGridPipeline.ts', 'plotDeductionFourGridPipeline'],
  ['src/services/pipelines/scenes/coherentStoryboard25Pipeline.ts', 'coherentStoryboard25Pipeline'],
  ['src/services/pipelines/scenes/cinematicLightCorrectionPipeline.ts', 'runLocal'],
  ['src/services/pipelines/scenes/upscalePipeline.ts', 'runLocal'],
  ['src/services/tasks/taskClient.ts', 'retryTask'],
  ['src/services/tasks/taskClient.ts', 'cancelTask'],
  ['src/services/tasks/taskClient.ts', 'calculateTaskCost'],
  ['src/services/projects/projectClient.ts', 'saveProject'],
  ['src/services/templates/templateClient.ts', 'publishProjectTemplate'],
  ['src/hooks/useSceneTaskRunner.ts', 'getRestorableSceneTasks'],
  ['src/utils/sceneGridActions.ts', 'createSceneGridUpscaleNode'],
  ['src/components/canvas/SceneResultPanel.tsx', '取消任务'],
  ['src/components/canvas/SceneResultPanel.tsx', '预计消耗'],
  ['src/components/canvas/SceneResultPanel.tsx', '单格放大'],
  ['server/routes/tasks.js', '/retry'],
  ['server/routes/projects.js', "router.delete('/:projectId'"],
  ['server/routes/templates.js', 'create-project'],
  ['server/services/mockTasks.js', 'redactTaskForStorage'],
  ['server/services/mockTasks.js', 'providerFallback'],
  ['server/services/mockTasks.js', 'gridItemIndex'],
];

const failures = [];

for (const [relativePath, needle] of checks) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} missing`);
    continue;
  }
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!content.includes(needle)) {
    failures.push(`${relativePath} missing marker: ${needle}`);
  }
}

if (failures.length > 0) {
  console.error('Canvas rescue verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Canvas rescue verification passed (${checks.length} checks).`);
