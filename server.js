require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const db = require('./db');
const translationRoutes = require('./routes/translationRoutes');
const sttRoutes = require('./routes/sttRoutes');
const ttsRoutes = require('./routes/ttsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/translations', translationRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/tts', ttsRoutes);

app.get('/', (req, res) => {
    res.json({ 
        message: 'Translation API Server is running!',
        timestamp: new Date().toISOString()
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

async function startServer() {
    try {
        await db.initializeDB(); 
        app.listen(PORT);
    } catch (err) {
        process.exit(1);
    }
}

startServer();