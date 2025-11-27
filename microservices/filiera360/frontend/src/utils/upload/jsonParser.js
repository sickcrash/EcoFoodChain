import { normalizeProduct } from './normalize';

export const parseJSON = (raw) => {
  const arr = Array.isArray(raw) ? raw : [raw];

  const mergeCustomObjects = (item) => {
    let customObj = {};
    Object.keys(item).forEach((key) => {
      if (key.toLowerCase().startsWith('customobject')) {
        try {
          Object.assign(customObj, typeof item[key] === 'string' ? JSON.parse(item[key]) : item[key]);
        } catch {
          customObj[key] = item[key];
        }
      }
    });
    return customObj;
  };

  return arr.map((item) => ({
    ...normalizeProduct(item),
    CustomObject: mergeCustomObjects(item),
  }));
};
