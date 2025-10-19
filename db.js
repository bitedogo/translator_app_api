const oracledb = require('oracledb');

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT
};

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const createTable = async (connection, tableName, tableSchema) => {
    const sql = `
        BEGIN
          EXECUTE IMMEDIATE '
            CREATE TABLE ${tableName} (
              ${tableSchema}
            )
          ';
        EXCEPTION
          WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;
            ELSE RAISE;
            END IF;
        END;
    `;
    await connection.execute(sql);
    console.log(`Table ${tableName} ensured.`);
};

async function initializeDB() {
    let connection;
    try {
        console.log('Connecting to Oracle DB...');
        connection = await oracledb.getConnection(dbConfig);
        console.log('Connected to Oracle DB');

        await createTable(connection, 'TRANSLATIONS', `
            id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            original_text CLOB,
            translated_text CLOB,
            from_lang VARCHAR2(10),
            to_lang VARCHAR2(10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        
        await createTable(connection, 'STT_RECORDS', `
            ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            AUDIO_URL VARCHAR2(255) NOT NULL,
            RECOGNIZED_TEXT CLOB NOT NULL,
            DURATION_SEC NUMBER(5, 2),
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await createTable(connection, 'TTS_RECORDS', `
            ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            INPUT_TEXT CLOB NOT NULL,
            AUDIO_URL VARCHAR2(255) NOT NULL,
            VOICE_SETTING VARCHAR2(50),
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        
        console.log('Database initialized (3 tables confirmed).');
    } catch (err) {
        console.error('DB initialization error:', err.message);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

async function executeQuery(sql, binds = [], opts = {}) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(sql, binds, opts);
        return result;
    } catch (err) {
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

module.exports = {
    initializeDB,
    executeQuery,
    oracledb
};