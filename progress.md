# Progress

## Status
Done — api-design-discussion, migration-and-deprecation, concurrency-and-performance

## Tasks
- [x] api-design-discussion: MD + MP3 + 5 buttons
- [x] migration-and-deprecation: MD + MP3 + 5 buttons
- [x] concurrency-and-performance: MD + MP3 + 5 buttons

## Files Changed
- docs/english/api-design-discussion.md (created)
- docs/public/audio/api-design-discussion.mp3 (created)
- docs/english/migration-and-deprecation.md (created)
- docs/public/audio/migration-and-deprecation.mp3 (created)
- docs/english/concurrency-and-performance.md (created)
- docs/public/audio/concurrency-and-performance.mp3 (created)

## Notes
- api-design-discussion: TTS 8 段，36s
- migration-and-deprecation: TTS 8 段，28.6s，鉴权 OK（source ~/.pi/agent/.env）
- concurrency-and-performance: TTS 10 段，43.8s，鉴权 OK（source ~/.pi/agent/.env）
- /tmp dialog 已删
- 未改 .vocab.json / config.js
- 并行兄弟篇（daily-standup-sync / concurrency-and-performance / production-rollback）由其他 worker 处理

## production-rollback（本 worker）
- [x] production-rollback: MD + MP3 + 5 buttons
- docs/english/production-rollback.md (created)
- docs/public/audio/production-rollback.mp3 (created, 8 段, 52.8s)
- TTS 鉴权 OK（source ~/.pi/agent/.env）
- /tmp/english-dialog-production-rollback.json 已删
- 未改 .vocab.json / config.js（sha 与基线一致）

## daily-standup-sync — DONE
- MD: docs/english/daily-standup-sync.md ✓ (5 buttons, &amp;type=2)
- MP3: docs/public/audio/daily-standup-sync.mp3 ✓ (26.78s, 8段)
- 词: refactor merge conflict branch pipeline 全融入加粗
- vocab/config: 未改 ✓
- status: 内容+TTS完成，待父会话统一回写vocab+config+commit
