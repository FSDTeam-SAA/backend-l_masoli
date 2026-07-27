import { dayKey, diffInDayKeys, safeTimezone } from './dateHelper.js';

export const formatDateLabel = (date, timezone = 'UTC') => {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
};

export const relativeDueLabel = (dueDate, timezone = 'UTC', now = new Date()) => {
  if (!dueDate) return null;

  const days = diffInDayKeys(dayKey(now, timezone), dayKey(dueDate, timezone));

  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 14) return 'In 1 week';
  if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
  if (days < 60) return 'In 1 month';
  if (days < 365) return `In ${Math.floor(days / 30)} months`;

  return `In ${Math.floor(days / 365)} year${days >= 730 ? 's' : ''}`;
};

export const relativeUpdatedLabel = (date, now = new Date()) => {
  if (!date) return null;

  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (seconds < 31536000) {
    const months = Math.floor(seconds / 2592000);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(seconds / 31536000);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

export const greetingFor = (timezone = 'UTC', now = new Date()) => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone(timezone),
      hour: 'numeric',
      hour12: false
    }).format(now)
  );

  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';

  return 'Good Night';
};

export const progressSubtitle = (progress) => {
  if (progress === 0) return 'Every big dream starts with one small step.';
  if (progress < 25) return 'You have made a start - keep the momentum going.';
  if (progress < 50) return 'Steady progress. Small wins build the dream.';
  if (progress < 75) return "You're making it happen - keep the momentum going.";
  if (progress < 100) return 'Almost there. Finish strong.';

  return 'Every dream on your board is complete. Time to dream bigger.';
};
