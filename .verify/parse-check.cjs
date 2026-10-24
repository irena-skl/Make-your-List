/* 解析逻辑单测（node parse-check.cjs 运行） */
global.window = global;
require('../assets/parse.js');
var P = window.VideoParser;

var cases = [
  'https://www.youtube.com/watch?v=br6ntQkeY7k',
  'https://youtu.be/br6ntQkeY7k',
  'https://youtu.be/br6ntQkeY7k?t=30',
  'https://www.youtube.com/shorts/br6ntQkeY7k',
  'https://www.youtube.com/embed/br6ntQkeY7k',
  'https://www.youtube.com/live/br6ntQkeY7k',
  'https://m.youtube.com/watch?v=br6ntQkeY7k&feature=share',
  'https://music.youtube.com/watch?v=br6ntQkeY7k',
  'https://www.youtube-nocookie.com/embed/br6ntQkeY7k',
  'youtube.com/watch?v=br6ntQkeY7k',
  '  https://www.youtube.com/watch?v=br6ntQkeY7k&t=1m30s  ',
  'https://www.youtube.com/watch?v=short',       // ID 长度不足，应失败
  'https://v.qq.com/x/cover/mzc00200abcdef.html', // 非 YouTube，应失败
  'https://www.bilibili.com/video/BV1xx411c7mD',  // 非 YouTube，应失败
  'not a url at all',                            // 应失败
  ''
];

var pass = 0, fail = 0;
cases.forEach(function (u) {
  var r = P.parseVideoUrl(u);
  var expectOk = /br6ntQkeY7k/.test(u);
  var ok = expectOk ? (r && r.id === 'br6ntQkeY7k') : (r === null);
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + JSON.stringify(u) + ' => ' +
    (r ? r.platform + ':' + r.id + ' start=' + r.startTime : 'null'));
});

console.log('---');
console.log('thumb[0]:', P.thumbnailUrls({ id: 'br6ntQkeY7k' })[0]);
console.log('embed   :', P.embedUrl({ id: 'br6ntQkeY7k' }, true));
console.log('---');
console.log('result: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
