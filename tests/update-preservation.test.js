import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import mongoose from 'mongoose';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Priority from '../models/priority.model.js';
import Dream from '../models/dream.model.js';
import { updateGoal } from '../controllers/goal.controller.js';
import { updateMilestone } from '../controllers/milestone.controller.js';
import { updateGoalSchema } from '../validations/goal.validation.js';
import { updateMilestoneSchema } from '../validations/milestone.validation.js';
import requireAccess from '../middlewares/requireAccess.js';

const id = (suffix) => new mongoose.Types.ObjectId(suffix.toString().padStart(24, '0'));
const user = { _id: id(1), activeTier: 'free', timezone: 'UTC' };
const completedAt = new Date('2025-01-02T10:00:00Z');
afterEach(() => mock.restoreAll());

function call(handler, body, schema) {
  return new Promise((resolve, reject) => {
    const req = { user, params: { id: String(id(2)) }, ...schema.parse({ body }) };
    const res = { status() { return this; }, json: resolve };
    handler(req, res, reject);
  });
}

function goalFixture({ occupied = 0 } = {}) {
  const doc = Goal.hydrate({
    _id: id(2), user: user._id, dream: id(3), title: 'Original goal',
    description: 'My description', areaOfLife: id(4), priority: id(5),
    targetDate: new Date('2025-02-01T00:00:00Z'), status: 'active',
    progress: 67, totalMilestones: 3, completedMilestones: 2,
    isManuallyCompleted: false, completedAt: null, isDeleted: false, __v: 0
  });
  mock.method(Goal, 'findOne', async () => doc);
  mock.method(doc, 'populate', async () => doc);
  mock.method(AreaOfLife, 'exists', async () => true);
  mock.method(Priority, 'exists', async () => true);
  mock.method(Dream, 'exists', async () => true);
  mock.method(Dream, 'findById', async () => null);
  const count = mock.method(Goal, 'countDocuments', async () => occupied);
  const writes = [];
  mock.method(Goal.collection, 'updateOne', async (filter, update) => {
    writes.push({ filter, update });
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const milestoneWrites = mock.method(Milestone.collection, 'updateOne', async () => {
    throw new Error('Goal edits must not modify milestones');
  });
  return { doc, writes, count, milestoneWrites };
}

function milestoneFixture() {
  const doc = Milestone.hydrate({
    _id: id(2), user: user._id, goal: id(7), title: 'A completed step',
    dueDate: new Date('2025-01-01T00:00:00Z'), isCompleted: true,
    completedAt, order: 2, isDeleted: false, __v: 0
  });
  mock.method(Milestone, 'findOne', async () => doc);
  const writes = [];
  mock.method(Milestone.collection, 'updateOne', async (filter, update) => {
    writes.push({ filter, update });
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const count = mock.method(Goal, 'countDocuments', async () => {
    throw new Error('Editing a milestone must not check creation limits');
  });
  const deletion = mock.method(Milestone.collection, 'deleteOne', async () => {
    throw new Error('Rescheduling must not delete the milestone');
  });
  return { doc, writes, count, deletion };
}

test('schemas expose Goal description, Milestone title/date, and strip completion changes', () => {
  assert.ok(Goal.schema.path('description'));
  assert.equal(Milestone.schema.path('description'), undefined);
  assert.deepEqual(updateGoalSchema.parse({ body: { title: 'New goal', progress: 0, milestones: [], completedMilestones: 0 } }).body, { title: 'New goal' });
  assert.deepEqual(updateMilestoneSchema.parse({ body: { title: 'New step', isCompleted: false, completedAt: null } }).body, { title: 'New step' });
});

test('Goal edits emit only dirty $set fields and preserve progress and completed milestones', async () => {
  const { doc, writes, count, milestoneWrites } = goalFixture({ occupied: 1 });
  await call(updateGoal, {
    title: 'Updated goal', description: '', priority: String(id(6)),
    targetDate: '2027-03-04T00:00:00Z', areaOfLife: String(id(4)),
    progress: 0, completedMilestones: 0, milestones: []
  }, updateGoalSchema);
  assert.equal(count.mock.callCount(), 0, 'unchanged Area never checks its capacity');
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].update), ['$set']);
  assert.deepEqual(Object.keys(writes[0].update.$set).sort(), ['description', 'priority', 'targetDate', 'title', 'updatedAt']);
  assert.equal(doc.progress, 67);
  assert.equal(doc.completedMilestones, 2);
  assert.equal(doc.totalMilestones, 3);
  assert.equal(doc.status, 'active');
  assert.equal(doc.isManuallyCompleted, false);
  assert.equal(milestoneWrites.mock.callCount(), 0);
});

test('trial move into an occupied Area returns the existing limit error without a write', async () => {
  const { writes, count } = goalFixture({ occupied: 1 });
  await assert.rejects(call(updateGoal, { areaOfLife: String(id(6)) }, updateGoalSchema), (error) => {
    assert.equal(error.statusCode, 403);
    assert.equal(error.message, "You've reached your free trial limit of 1 Goal for this Area of Life. Upgrade to Premium to create unlimited Goals.");
    return true;
  });
  assert.equal(writes.length, 0);
  assert.equal(count.mock.callCount(), 1);
});

test('moving into an empty custom Area changes only the Area, retaining progress', async () => {
  const { doc, writes } = goalFixture();
  await call(updateGoal, { areaOfLife: String(id(6)) }, updateGoalSchema);
  assert.deepEqual(Object.keys(writes[0].update.$set).sort(), ['areaOfLife', 'updatedAt']);
  assert.equal(String(doc.areaOfLife), String(id(6)));
  assert.equal(doc.progress, 67);
});

test('Milestone title/date edits preserve completion and never check creation limits', async () => {
  const { doc, writes, count, deletion } = milestoneFixture();
  await call(updateMilestone, { title: 'Renamed completed step', dueDate: '2027-04-05T00:00:00Z', isCompleted: false }, updateMilestoneSchema);
  assert.deepEqual(Object.keys(writes[0].update), ['$set']);
  assert.deepEqual(Object.keys(writes[0].update.$set).sort(), ['dueDate', 'title', 'updatedAt']);
  assert.equal(doc.isCompleted, true);
  assert.equal(doc.completedAt.getTime(), completedAt.getTime());
  assert.equal(doc.order, 2);
  assert.equal(count.mock.callCount(), 0);
  assert.equal(deletion.mock.callCount(), 0);
});

test('rescheduling alone retains the same milestone ID and completion fields', async () => {
  const { doc, writes, deletion } = milestoneFixture();
  await call(updateMilestone, { dueDate: '2027-09-10T00:00:00Z' }, updateMilestoneSchema);
  assert.equal(String(doc._id), String(id(2)));
  assert.deepEqual(Object.keys(writes[0].update.$set).sort(), ['dueDate', 'updatedAt']);
  assert.equal(doc.isCompleted, true);
  assert.equal(doc.completedAt.getTime(), completedAt.getTime());
  assert.equal(deletion.mock.callCount(), 0);
});

test('the shared access middleware blocks locked accounts', () => {
  let denial;
  requireAccess({ user: { accessLevel: 'locked' } }, {}, (error) => { denial = error; });
  assert.equal(denial.statusCode, 403);
  assert.equal(denial.code, 'SUBSCRIPTION_REQUIRED');
});
