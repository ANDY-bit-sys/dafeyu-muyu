// Shared with animation.json; retained 15-frame assets are in assets/animation-15-v1/.
window.muyuAnimation = {"version":1,"base":"assets/","frames":[{"name":"idle","label":"待机","duration":0,"file":"dafeyu-idle-v2.png"},{"name":"strike","label":"接触","duration":140,"file":"dafeyu-strike-v2.png"}]};
if (new URLSearchParams(location.search).get('frames') === '2') window.muyuAnimation.preview = true;
