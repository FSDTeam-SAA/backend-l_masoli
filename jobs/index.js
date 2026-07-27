import cron from 'node-cron';
import env from '../config/env.js';
import runMilestoneReminders from './milestoneReminder.job.js';
import runGoalReminders from './goalReminder.job.js';
import runDailyInspiration from './dailyInspiration.job.js';
import runProgressSnapshot from './progressSnapshot.job.js';
import runCleanup from './cleanup.job.js';

const SCHEDULES = [
  { name: 'milestone-reminders', expression: '0 8 * * *', task: runMilestoneReminders },
  { name: 'goal-reminders', expression: '0 9 * * *', task: runGoalReminders },
  { name: 'daily-inspiration', expression: '0 7 * * *', task: runDailyInspiration },
  { name: 'progress-snapshot', expression: '5 0 * * *', task: runProgressSnapshot },
  { name: 'cleanup', expression: '30 3 * * 0', task: runCleanup }
];

const guard = (name, task) => async () => {
  try {
    await task();
  } catch (error) {
    console.error(`[cron] ${name} failed:`, error.message);
  }
};

const startJobs = () => {
  const timezone = env.ADMIN_TIMEZONE;

  SCHEDULES.forEach(({ name, expression, task }) => {
    cron.schedule(expression, guard(name, task), { timezone });
  });

  console.log(`Scheduled ${SCHEDULES.length} cron jobs (timezone: ${timezone})`);
};

export const JOB_REGISTRY = SCHEDULES.reduce((registry, { name, task }) => {
  registry[name] = task;
  return registry;
}, {});

export default startJobs;
