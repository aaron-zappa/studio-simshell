-- src/sql-scripts/admin_init_rbac.sql
-- This is an admin script and should be filtered out from the dropdown

-- Sample RBAC initialization commands
CREATE TABLE IF NOT EXISTS roles_admin_test (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions_admin_test (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name VARCHAR(100) NOT NULL UNIQUE
);

INSERT OR IGNORE INTO roles_admin_test (role_name) VALUES ('admin_viewer');
INSERT OR IGNORE INTO permissions_admin_test (permission_name) VALUES ('view_admin_data');

-- This script is intentionally simple and for testing the filtering mechanism.
-- It doesn't represent a complete RBAC setup.
SELECT 'Admin script executed (for testing filter)' AS message;
