const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    port: process.env.MYSQL_PORT || 3306
  });

  try {
    const sqlFile = path.join(__dirname, '../init-db.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
        console.log('✓ Ejecutado:', statement.substring(0, 50) + '...');
      }
    }
    
    console.log('\n✓ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('✗ Error al inicializar la base de datos:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initializeDatabase();
