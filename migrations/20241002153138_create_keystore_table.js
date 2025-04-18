/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTableIfNotExists('keystore', (table) => {
    table.increments('id').primary(); // Auto-incrementing primary key
    table.string('email').unique().notNullable(); // Email, unique
    table.string('hashed_key').notNullable(); // Hashed API key
    table.timestamp('created').defaultTo(knex.fn.now()); // Creation timestamp
    table.timestamp('last_accessed'); // Last accessed timestamp
    table.integer('status').notNullable(); // Status (e.g., active, inactive)
    table.integer('request_count').defaultTo(0); // Request count for rate limiting or monthly allowance
    table.integer('request_limit').defaultTo(1000); // Max requests allowed
    table.timestamp('period_start').defaultTo(knex.fn.now()); // Start of current quota period
    table.string('role').defaultTo('free'); // Role to manage access, e.g., free or premium
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('keystore');
};
