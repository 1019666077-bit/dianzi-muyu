# CHANGELOG · Daily Retention (schema v3)

- 本地 schema 升至 v3：新增 `streakDays` / `streakLastDate` / `streakFreezeMonth` / `streakFreezeUsed`，以及广告日配额 `adQuotaDate` / `adGrantAutoCount` / `adGrantSkinCount`。
- 顶栏主数字改为今日功德，总功德为辅；不做订阅消息、云开发或 P1-B。
- 激励上限：快敲 2 次/自然日、皮肤 3 次/自然日（本地 `YYYY-MM-DD`）；连续天数可每月冻结一次（隔 1 天不断档）。
