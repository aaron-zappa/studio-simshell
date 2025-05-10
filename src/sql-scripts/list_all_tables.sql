-- src/sql-scripts/list_all_tables.sql
SELECT * FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
