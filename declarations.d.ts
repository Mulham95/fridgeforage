// Ambient declarations so `tsc` resolves CSS imports used by the web template
// files (these are only meaningful on react-native-web; native ignores them).
declare module '*.css';
declare module '*.module.css';
