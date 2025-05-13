// knexfile.js

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './data/simushell_export.db'
    },
    migrations: {
      directory: './migrations'
    },
    useNullAsDefault: true // Recommended for SQLite
  },
};