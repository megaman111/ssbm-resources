export default {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Keep path data precision low for smaller files
          convertPathData: {
            floatPrecision: 1,
          },
        },
      },
    },
  ],
};
