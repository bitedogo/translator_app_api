const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', async (req, res) => {
    const { inputText, audioUrl, voiceSetting } = req.body; 
    
    if (!inputText || !audioUrl) {
        return res.status(400).json({ success: false, error: 'Missing required fields: inputText, audioUrl' });
    }
    
    try {
        const result = await db.executeQuery(
            `INSERT INTO TTS_RECORDS (input_text, audio_url, voice_setting)
             VALUES (:inputText, :audioUrl, :voiceSetting)
             RETURNING id INTO :id`,
            {
                inputText,
                audioUrl,
                voiceSetting: voiceSetting || 'default',
                id: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
            },
            { autoCommit: true }
        );
        
        const insertedId = result.outBinds.id[0];
        res.json({ success: true, id: insertedId, message: 'TTS record saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to save TTS record', details: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT id, input_text, audio_url, voice_setting,
                    TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
             FROM TTS_RECORDS
             ORDER BY created_at DESC`
        );
        
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch TTS records', details: err.message });
    }
});

module.exports = router;