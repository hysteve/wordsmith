// knexfile.js
export default {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './db/keystore.db',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
    },
  },
};