import express from 'express';
import { cancelTask, createTask, estimateCost, getTasks } from '../services/mockTasks.js';

const router = express.Router();

router.post('/create', (req, res) => {
  const task = createTask(req.body);
  res.json({ success: true, taskId: task.taskId });
});

router.post('/status', (req, res) => {
  const taskIds = Array.isArray(req.body?.taskIds) ? req.body.taskIds : [];
  res.json({
    success: true,
    tasks: getTasks(taskIds).map((task) => ({
      taskId: task.taskId,
      requestId: task.requestId,
      status: task.status,
      progressPercent: task.progressPercent,
      result: task.result,
      errorMessage: task.errorMessage,
      childTasks: task.childTasks?.map((child) => ({
        taskId: child.taskId,
        index: child.index,
        status: child.status,
        progressPercent: child.progressPercent,
        result: child.result,
        errorMessage: child.errorMessage,
      })),
    })),
  });
});

router.post('/cancel', (req, res) => {
  res.json({ success: Boolean(req.body?.taskId && cancelTask(req.body.taskId)) });
});

router.post('/cancel-batch', (req, res) => {
  const taskIds = Array.isArray(req.body?.taskIds) ? req.body.taskIds : [];
  res.json({
    success: true,
    cancelledTaskIds: taskIds.filter((taskId) => cancelTask(taskId)),
  });
});

router.post('/calculate-cost', (req, res) => {
  res.json({
    success: true,
    estimatedCost: estimateCost(req.body),
    unit: 'energy',
  });
});

router.post('/retry', (req, res) => {
  const task = createTask(req.body?.request || {});
  res.json({ success: true, taskId: task.taskId });
});

export default router;
