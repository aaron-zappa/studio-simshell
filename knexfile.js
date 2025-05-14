// knexfile.js

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './data/sim_shell.db' // Updated filename
    },
    migrations: {
      directory: './migrations'
    },
    useNullAsDefault: true // Recommended for SQLite
  },
};
