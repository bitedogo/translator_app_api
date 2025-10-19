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
app.use(bodyParser.urlencoded({ extended: true }));

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
        
        app.listen(PORT, () => {
            console.log('=================================');
            console.log('Server is running on port', PORT);
            console.log('Local: http://localhost:' + PORT);
            console.log('Health check: http://localhost:' + PORT + '/');
            console.log('=================================');
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

startServer();

process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});