const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/programa_abaniko'
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registros (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        telefono VARCHAR(20),
        contenido TEXT,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha_registro DESC);
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function addRegistro(nombre, email, telefono, contenido) {
  const query = `
    INSERT INTO registros (nombre, email, telefono, contenido)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await pool.query(query, [nombre, email, telefono, contenido]);
  return result.rows[0];
}

async function getRegistros() {
  const query = 'SELECT * FROM registros ORDER BY fecha_registro DESC;';
  const result = await pool.query(query);
  return result.rows;
}

async function getRegistroById(id) {
  const query = 'SELECT * FROM registros WHERE id = $1;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

module.exports = {
  pool,
  initializeDatabase,
  addRegistro,
  getRegistros,
  getRegistroById
};
