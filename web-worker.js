// Serves the exported web build (dist/) as static assets from a *.workers.dev
// URL. Used because some networks DNS-block *.pages.dev — workers.dev is not.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
