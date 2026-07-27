import env from '../config/env.js';
import User from '../models/user.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Priority from '../models/priority.model.js';
import Badge from '../models/badge.model.js';
import StaticPage from '../models/staticPage.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import { BADGE_METRIC, PAGE_SLUG, ROLES } from '../constants/index.js';

const AREAS = [
  { name: 'Faith', slug: 'faith', icon: 'sparkles', color: '#8B5CF6', order: 1 },
  { name: 'Family', slug: 'family', icon: 'users', color: '#EC4899', order: 2 },
  { name: 'Health', slug: 'health', icon: 'heart-pulse', color: '#10B981', order: 3 },
  { name: 'Business & Career', slug: 'business-career', icon: 'briefcase', color: '#3B82F6', order: 4 },
  { name: 'Fun & Travel', slug: 'fun-travel', icon: 'plane', color: '#F59E0B', order: 5 }
];

const PRIORITIES = [
  { name: 'High', slug: 'high', color: '#EF4444', weight: 3, order: 1 },
  { name: 'Medium', slug: 'medium', color: '#F59E0B', weight: 2, order: 2 },
  { name: 'Low', slug: 'low', color: '#64748B', weight: 1, order: 3 }
];

const BADGES = [
  {
    code: 'first_step',
    name: 'First Step',
    description: 'Create your very first goal',
    icon: 'flag',
    order: 1,
    criteria: { metric: BADGE_METRIC.GOALS_CREATED, threshold: 1 }
  },
  {
    code: 'dream_starter',
    name: 'Dream Starter',
    description: 'Complete your first milestone',
    icon: 'check-circle',
    order: 2,
    criteria: { metric: BADGE_METRIC.MILESTONES_COMPLETED, threshold: 1 }
  },
  {
    code: 'goal_getter',
    name: 'Goal Getter',
    description: 'Complete your first goal',
    icon: 'target',
    order: 3,
    criteria: { metric: BADGE_METRIC.GOALS_COMPLETED, threshold: 1 }
  },
  {
    code: 'on_a_roll',
    name: 'On a Roll',
    description: 'Keep a 7 day streak',
    icon: 'flame',
    order: 4,
    criteria: { metric: BADGE_METRIC.STREAK_CURRENT, threshold: 7 }
  },
  {
    code: 'unstoppable',
    name: 'Unstoppable',
    description: 'Keep a 30 day streak',
    icon: 'zap',
    order: 5,
    criteria: { metric: BADGE_METRIC.STREAK_CURRENT, threshold: 30 }
  },
  {
    code: 'visionary',
    name: 'Visionary',
    description: 'Create your first dream board',
    icon: 'eye',
    order: 6,
    criteria: { metric: BADGE_METRIC.BOARDS_CREATED, threshold: 1 }
  },
  {
    code: 'curator',
    name: 'Curator',
    description: 'Add 20 images to your dream boards',
    icon: 'image',
    order: 7,
    criteria: { metric: BADGE_METRIC.IMAGES_UPLOADED, threshold: 20 }
  },
  {
    code: 'dream_achiever',
    name: 'Dream Achiever',
    description: 'Complete 5 goals',
    icon: 'trophy',
    order: 8,
    criteria: { metric: BADGE_METRIC.GOALS_COMPLETED, threshold: 5 }
  }
];

const QUOTES = [
  { text: 'Progress, not perfection. One milestone at a time.' },
  { text: 'Small wins build the dream.' },
  { text: 'The best time to start was yesterday. The next best time is now.' },
  { text: 'Dreams do not work unless you do.' },
  { text: 'A goal without a plan is just a wish.', author: 'Antoine de Saint-Exupery' },
  { text: 'You do not have to be great to start, but you have to start to be great.' },
  { text: 'Discipline is choosing between what you want now and what you want most.' },
  { text: 'Every accomplishment starts with the decision to try.' }
];

const PAGES = [
  {
    slug: PAGE_SLUG.ABOUT,
    title: 'About App',
    content:
      'My Dream Board helps you turn big dreams into small, achievable milestones. Set goals across every area of your life, break them down, and keep a vision board that reminds you why you started.'
  },
  {
    slug: PAGE_SLUG.PRIVACY_POLICY,
    title: 'Privacy Policy',
    content: 'Replace this content from the admin dashboard with your production privacy policy.'
  },
  {
    slug: PAGE_SLUG.TERMS,
    title: 'Terms & Privacy',
    content: 'Replace this content from the admin dashboard with your production terms of service.'
  }
];

const upsertMany = async (Model, rows, uniqueKey, extra = {}) => {
  const operations = rows.map((row) => ({
    updateOne: {
      filter: { [uniqueKey]: row[uniqueKey] },
      update: { $setOnInsert: { ...row, ...extra } },
      upsert: true
    }
  }));

  const result = await Model.bulkWrite(operations);
  return result.upsertedCount;
};

const seed = async () => {
  const areas = await upsertMany(AreaOfLife, AREAS, 'slug', { isDefault: true, isActive: true });
  const priorities = await upsertMany(Priority, PRIORITIES, 'slug', { isDefault: true, isActive: true });
  const badges = await upsertMany(Badge, BADGES, 'code', { isActive: true });
  const pages = await upsertMany(StaticPage, PAGES, 'slug');
  const quotes = await upsertMany(MotivationQuote, QUOTES, 'text', { isActive: true });

  let adminCreated = false;
  const existingAdmin = await User.findOne({ email: env.SUPER_ADMIN_EMAIL.toLowerCase() });

  if (!existingAdmin) {
    await User.create({
      userName: env.SUPER_ADMIN_NAME,
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true
    });
    adminCreated = true;
  }

  return { areas, priorities, badges, pages, quotes, adminCreated };
};

export default seed;
