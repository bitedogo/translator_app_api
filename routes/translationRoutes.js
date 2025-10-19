const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';

router.post('/', async (req, res) => {
    console.log('Received translation request:', req.body);
    
    const { originalText, fromLang, toLang } = req.body;
    let translatedText;

    if (!originalText || !fromLang || !toLang) {
        console.log('Missing fields - originalText:', !!originalText, 'fromLang:', !!fromLang, 'toLang:', !!toLang);
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: originalText, fromLang, toLang',
            received: { originalText: !!originalText, fromLang: !!fromLang, toLang: !!toLang }
        });
    }
    
    try {
        const response = await axios.get(MYMEMORY_API_URL, {
            params: {
                q: originalText,
                langpair: `${fromLang}|${toLang}`
            },
            timeout: 10000
        });

        console.log('MyMemory API Response:', response.data);

        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            translatedText = response.data.responseData.translatedText;
        } else {
            console.error('MyMemory API Error Response:', response.data);
            return res.status(500).json({ 
                success: false, 
                error: 'Translation service returned an invalid response.', 
                details: response.data || 'No response data'
            });
        }
    } catch (apiErr) {
        console.error('External API call error:', apiErr.message);
        
        if (apiErr.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                success: false, 
                error: 'Translation service timeout. Please try again.',
                details: 'Request timed out after 10 seconds'
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to connect to the external translation service.',
            details: apiErr.message
        });
    }

    try {
        const result = await db.executeQuery(
            `INSERT INTO translations (original_text, translated_text, from_lang, to_lang)
             VALUES (:originalText, :translatedText, :fromLang, :toLang)
             RETURNING id INTO :id`,
            {
                originalText,
                translatedText,
                fromLang,
                toLang,
                id: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER }
            },
            { autoCommit: true }
        );
        
        const insertedId = result.outBinds.id[0];
        res.json({ 
            success: true, 
            id: insertedId, 
            originalText,
            translatedText,
            message: 'Translation saved successfully' 
        });

    } catch (dbErr) {
        console.error('Translation DB save error:', dbErr.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save translation history to database.', 
            details: dbErr.message 
        });
    }
});

router.get('/recent', async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    
    try {
        const result = await db.executeQuery(
            `SELECT id, original_text, translated_text, from_lang, to_lang, 
                    TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
             FROM translations
             ORDER BY created_at DESC
             FETCH FIRST :limit ROWS ONLY`,
            { limit }
        );
        
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error('Translation fetch error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch translations', 
            details: err.message 
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT id, original_text, translated_text, from_lang, to_lang,
                    TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
             FROM translations
             ORDER BY created_at DESC`
        );
        
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error('Translation fetch error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch all translations', 
            details: err.message 
        });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.executeQuery(
            `DELETE FROM translations WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Translation not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Translation deleted successfully' 
        });
    } catch (err) {
        console.error('Translation delete error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete translation', 
            details: err.message 
        });
    }
});

router.delete('/', async (req, res) => {
    try {
        const result = await db.executeQuery(
            `DELETE FROM translations`,
            [],
            { autoCommit: true }
        );
        
        res.json({ 
            success: true, 
            deletedCount: result.rowsAffected, 
            message: 'All translations deleted successfully' 
        });
    } catch (err) {
        console.error('Translation delete all error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete all translations', 
            details: err.message 
        });
    }
});

module.exports = router;