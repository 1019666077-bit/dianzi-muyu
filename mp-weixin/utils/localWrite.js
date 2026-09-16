/**
 * writeWhenPrivacy(app, fn)
 * fn: () => void，内部执行 setStorageSync
 */
function writeWhenPrivacy(app, fn) {
  if (app && typeof app.whenPrivacy === "function") {
    app.whenPrivacy((agreed) => {
      if (agreed && typeof fn === "function") fn();
    });
    return;
  }
  if (typeof fn === "function") fn();
}

module.exports = { writeWhenPrivacy };
