#!/bin/sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DATABASE_FILE="$PROJECT_ROOT/prisma/store.db"
MIGRATION_FILE="$PROJECT_ROOT/prisma/migrations/20260718151000_init/migration.sql"

mkdir -p "$(dirname "$DATABASE_FILE")"

if [ ! -f "$DATABASE_FILE" ] || ! sqlite3 "$DATABASE_FILE" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='User';" | grep -q 1; then
  sqlite3 -bail "$DATABASE_FILE" < "$MIGRATION_FILE"
  echo "SQLite 初始迁移已完成。"
else
  echo "数据库已初始化，跳过初始迁移。"
fi
