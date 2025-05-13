/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('variables2', function(table) {
    table.string('name', 255).notNullable().primary();
    table.string('datatype', 50).notNullable();
    table.text('value');
    table.float('max');
    table.float('min');
    table.text('default_value');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('variables2');
};
