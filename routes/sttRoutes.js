const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', async (req, res) => {
    const { audioUrl, recognizedText, durationSec } = req.body; 
    
    if (!audioUrl || !recognizedText) {
        return res.status(400).json({ success: false, error: 'Missing required fields: audioUrl, recognizedText' });
    }
    
    try {
        const result = await db.executeQuery(
            `INSERT INTO STT_RECORDS (audio_url, recognized_text, duration_sec)
             VALUES (:audioUrl, :recognizedText, :durationSec)
             RETURNING id INTO :id`,
            {
                audioUrl,
                recognizedText,
                durationSec: durationSec || null,
                id: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
            },
            { autoCommit: true }
        );
        
        const insertedId = result.outBinds.id[0];
        res.json({ success: true, id: insertedId, message: 'STT record saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to save STT record', details: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT id, audio_url, recognized_text, duration_sec,
                    TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
             FROM STT_RECORDS
             ORDER BY created_at DESC`
        );
        
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch STT records', details: err.message });
    }
});

module.exports = router;