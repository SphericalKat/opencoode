const objectKeys = new WeakMap<object, number>();
let nextObjectKey = 0;

/** Returns a stable numeric identity for an object, usable in React keys. */
export const objectKey = (value: object): number => {
  let key = objectKeys.get(value);
  if (key === undefined) {
    key = nextObjectKey;
    nextObjectKey += 1;
    objectKeys.set(value, key);
  }
  return key;
};
