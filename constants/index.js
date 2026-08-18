export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

export const ROLE_VALUES = Object.values(ROLES);

export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

export const USER_STATUS_VALUES = Object.values(USER_STATUS);

export const GOAL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

export const GOAL_STATUS_VALUES = Object.values(GOAL_STATUS);

export const OTP_TYPE = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset'
};

export const OTP_TYPE_VALUES = Object.values(OTP_TYPE);

export const NOTIFICATION_TYPE = {
  GOAL_REMINDER: 'goal_reminder',
  MILESTONE_REMINDER: 'milestone_reminder',
  DAILY_INSPIRATION: 'daily_inspiration',
  GOAL_COMPLETED: 'goal_completed',
  BADGE_EARNED: 'badge_earned',
  ANNOUNCEMENT: 'announcement',
  NEW_USER: 'new_user',
  SYSTEM: 'system'
};

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

export const NOTIFICATION_AUDIENCE = {
  USER: 'user',
  ADMIN: 'admin'
};

export const NOTIFICATION_AUDIENCE_VALUES = Object.values(NOTIFICATION_AUDIENCE);

export const ACTIVITY_TYPE = {
  LOGIN: 'login',
  GOAL_CREATED: 'goal_created',
  GOAL_COMPLETED: 'goal_completed',
  MILESTONE_COMPLETED: 'milestone_completed',
  BOARD_CREATED: 'board_created',
  DREAM_CREATED: 'dream_created'
};

export const ACTIVITY_TYPE_VALUES = Object.values(ACTIVITY_TYPE);

export const COLLAGE_LAYOUTS = [
  { key: 'grid-2', name: 'Two Column Grid', columns: 2, maxImages: 12 },
  { key: 'grid-3', name: 'Three Column Grid', columns: 3, maxImages: 18 },
  { key: 'mosaic', name: 'Mosaic', columns: 3, maxImages: 12 },
  { key: 'stack', name: 'Vertical Stack', columns: 1, maxImages: 8 },
  { key: 'hero', name: 'Hero + Thumbnails', columns: 3, maxImages: 10 }
];

export const COLLAGE_LAYOUT_KEYS = COLLAGE_LAYOUTS.map((layout) => layout.key);

export const BADGE_METRIC = {
  GOALS_CREATED: 'goals_created',
  GOALS_COMPLETED: 'goals_completed',
  MILESTONES_COMPLETED: 'milestones_completed',
  BOARDS_CREATED: 'boards_created',
  DREAMS_CREATED: 'dreams_created',
  STREAK_CURRENT: 'streak_current',
  AREAS_COVERED: 'areas_covered'
};

export const BADGE_METRIC_VALUES = Object.values(BADGE_METRIC);

export const PAGE_SLUG = {
  ABOUT: 'about',
  PRIVACY_POLICY: 'privacy-policy',
  TERMS: 'terms'
};

export const PAGE_SLUG_VALUES = Object.values(PAGE_SLUG);

export const DEVICE_PLATFORM_VALUES = ['android', 'ios', 'web'];

export const CHART_RANGE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

export const CHART_RANGE_VALUES = Object.values(CHART_RANGE);

export const CLOUDINARY_FOLDERS = {
  AVATARS: 'avatars',
  COVER_MOODS: 'cover-moods',
  BOARDS: 'boards',
  DREAMS: 'dreams'
};

export const SUBSCRIPTION_TIER = {
  FREE: 'free',
  PREMIUM: 'premium'
};

export const SUBSCRIPTION_TIER_VALUES = Object.values(SUBSCRIPTION_TIER);

export const SUBSCRIPTION_SOURCE_VALUES = ['none', 'manual', 'apple', 'google', 'stripe'];

export const UNLIMITED = -1;

export const PLAN_LIMITS = {
  [SUBSCRIPTION_TIER.FREE]: {
    boards: 2,
    dreamsPerBoard: 10,
    goals: 10,
    milestonesPerGoal: 15,
    customAreasOfLife: 3
  },
  [SUBSCRIPTION_TIER.PREMIUM]: {
    boards: UNLIMITED,
    dreamsPerBoard: UNLIMITED,
    goals: UNLIMITED,
    milestonesPerGoal: UNLIMITED,
    customAreasOfLife: UNLIMITED
  }
};

export const LIMIT_LABELS = {
  boards: 'dream board',
  dreamsPerBoard: 'dream on this board',
  goals: 'goal',
  milestonesPerGoal: 'milestone on this goal',
  customAreasOfLife: 'custom area of life'
};

export const ACTIVE_USER_WINDOW_DAYS = 30;

export const MAX_BOARD_IMAGES_PER_UPLOAD = 10;

/// A dream holds many images, so one request can now carry several dreams
/// worth of files - the per-request ceiling has to sit above the per-dream
/// one rather than equal it.
export const MAX_IMAGES_PER_DREAM = 10;

export const MAX_FILES_PER_UPLOAD = 30;
