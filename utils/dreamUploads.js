import { StatusCodes } from 'http-status-codes';
import ApiError from './ApiError.js';
import { MAX_IMAGES_PER_DREAM } from '../constants/index.js';

/// Multipart contract for dream uploads (see also the Flutter
/// DreamBoardRepositoryImpl, which is the only first-party client):
///
///   dreams   - JSON string: `[{ "title": "...", "story": "..." }, ...]`,
///              one entry per dream, in order.
///   images_N - the image files belonging to dreams[N]. Repeat the field
///              once per file; the first file of each group is that dream's
///              cover.
///   images / image - files with no dream index. Everything sent this way
///              belongs to a single dream (the one-dream endpoints, and the
///              shape the Postman collection still uses).
///
/// Field names are what tie a file to its dream, so a dropped or reordered
/// file can never silently slide onto the wrong dream the way a
/// count-and-slice payload could.
const INDEXED_FILE_FIELD = /^images?_(\d+)$/;
const FLAT_FILE_FIELDS = new Set(['images', 'image']);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

const toText = (value) => (typeof value === 'string' ? value.trim() : '');

const parseDreamMeta = (body = {}) => {
  if (typeof body.dreams === 'string' && body.dreams.trim()) {
    let parsed;

    try {
      parsed = JSON.parse(body.dreams);
    } catch {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'The dreams field must be valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'The dreams field must be a JSON array');
    }

    return parsed.map((entry) => ({
      title: toText(entry?.title),
      story: toText(entry?.story)
    }));
  }

  const titles = toArray(body.title);
  const stories = toArray(body.story);
  const length = Math.max(titles.length, stories.length);

  return Array.from({ length }, (unused, index) => ({
    title: toText(titles[index]),
    story: toText(stories[index])
  }));
};

/// Every uploaded image file on the request, whatever field carried it -
/// for the endpoints that build exactly one dream.
export const collectDreamFiles = (req) => {
  const files = Array.isArray(req.files) ? req.files : [];

  return files.filter(
    (file) => FLAT_FILE_FIELDS.has(file.fieldname) || INDEXED_FILE_FIELD.test(file.fieldname)
  );
};

export const assertImagesPerDream = (count) => {
  if (count > MAX_IMAGES_PER_DREAM) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `A dream can hold at most ${MAX_IMAGES_PER_DREAM} images`
    );
  }
};

/// Groups an upload into `[{ title, story, files }]`, one entry per dream.
/// Entries carrying neither a file nor any text are dropped, so a trailing
/// empty slot in the JSON never creates a blank dream.
export const groupDreamUploads = (req) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const indexed = new Map();
  const flat = [];

  files.forEach((file) => {
    const match = INDEXED_FILE_FIELD.exec(file.fieldname);

    if (match) {
      const index = Number(match[1]);
      if (!indexed.has(index)) indexed.set(index, []);
      indexed.get(index).push(file);
      return;
    }

    if (FLAT_FILE_FIELDS.has(file.fieldname)) flat.push(file);
  });

  const meta = parseDreamMeta(req.body);
  const highestIndex = indexed.size > 0 ? Math.max(...indexed.keys()) : -1;
  const count = Math.max(meta.length, highestIndex + 1, flat.length > 0 ? 1 : 0);

  const groups = [];

  for (let index = 0; index < count; index += 1) {
    const { title = '', story = '' } = meta[index] || {};
    // Un-indexed files all belong to the first dream - the one-dream shape.
    const groupFiles = indexed.get(index) || (index === 0 ? flat : []);

    if (groupFiles.length === 0 && !title && !story) continue;

    assertImagesPerDream(groupFiles.length);
    groups.push({ title, story, files: groupFiles });
  }

  return groups;
};
