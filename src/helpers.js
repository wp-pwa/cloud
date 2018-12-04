const mergeOptions = (base, custom) => {
  const options = Object.assign({ ...base }, custom || {});
  return Object.entries(options)
    .map(([k, v]) => (v !== '' ? `${k}=${v}` : k))
    .join(', ');
};

module.exports = {
  mergeOptions,
};
