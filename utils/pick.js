const pick = (source, keys) => {
  const result = {};

  keys.forEach((key) => {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  });

  return result;
};

export default pick;
