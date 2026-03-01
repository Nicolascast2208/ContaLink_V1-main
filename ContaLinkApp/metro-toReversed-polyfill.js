// Temporary polyfill for Array.prototype.toReversed
// Ensures metro-config (or other libraries) can call `toReversed()` on arrays
if (typeof Array.prototype.toReversed !== 'function') {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function toReversed() {
      return Array.prototype.slice.call(this).reverse();
    },
    configurable: true,
    writable: true,
  });
}
