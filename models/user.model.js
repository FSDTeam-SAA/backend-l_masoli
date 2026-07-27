import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { ROLES, ROLE_VALUES, USER_STATUS, USER_STATUS_VALUES } from '../constants/index.js';
import { safeTimezone } from '../utils/dateHelper.js';

const userSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.USER },
    avatar: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    bio: { type: String, maxlength: 500, default: '' },
    dateOfBirth: { type: Date, default: null },
    timezone: { type: String, default: 'UTC' },
    status: { type: String, enum: USER_STATUS_VALUES, default: USER_STATUS.ACTIVE },
    isEmailVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    passwordChangedAt: { type: Date, default: null },
    notificationSettings: {
      goalReminders: { type: Boolean, default: true },
      milestoneReminders: { type: Boolean, default: true },
      dailyInspiration: { type: Boolean, default: true }
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: Date, default: null }
    }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.index({ role: 1, status: 1, isDeleted: 1, createdAt: -1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastActiveAt: -1 });
userSchema.index({ userName: 'text', email: 'text' });

userSchema.virtual('fullName').get(function () {
  const composed = [this.firstName, this.lastName].filter(Boolean).join(' ');
  return composed || this.userName;
});

userSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - this.dateOfBirth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - this.dateOfBirth.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < this.dateOfBirth.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
});

userSchema.pre('save', function () {
  const composed = [this.firstName, this.lastName].filter(Boolean).join(' ');

  if (composed && (this.isModified('firstName') || this.isModified('lastName'))) {
    this.userName = composed;
  } else if (this.userName && !composed) {
    const parts = this.userName.trim().split(/\s+/);
    this.firstName = parts.shift() || '';
    this.lastName = parts.join(' ');
  }

  if (this.isModified('timezone')) {
    this.timezone = safeTimezone(this.timezone);
  }
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.isPasswordChangedAfter = function (issuedAtSeconds) {
  if (!this.passwordChangedAt) return false;

  return Math.floor(this.passwordChangedAt.getTime() / 1000) > issuedAtSeconds;
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

export default User;
