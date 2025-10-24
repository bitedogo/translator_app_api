const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

// MyMemory API 엔드포인트
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';

router.post('/', async (req, res) => {
    const { originalText, fromLang, toLang } = req.body;
    let translatedText; 

    if (!originalText || !fromLang || !toLang) {
        return res.status(400).json({ success: false, error: 'Missing required fields: originalText, fromLang, toLang' });
    }
    
    try {
        // 1. MyMemory API 호출 (GET 방식)
        const langPair = `${fromLang}|${toLang}`;
        
        const response = await axios.get(MYMEMORY_API_URL, {
            params: {
                q: originalText,
                langpair: langPair
            }
            // email 파라미터가 필요하다면 여기에 추가:
            // de: 'your-email@example.com'
        });

        // 2. MyMemory 응답 구조에서 번역 텍스트 추출
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            translatedText = response.data.responseData.translatedText;
        } else {
             // API가 200을 반환했으나 번역에 실패한 경우
             console.error('MyMemory API Error Response:', response.data);
             return res.status(500).json({ 
                success: false, 
                error: 'Translation service returned an invalid response.', 
                details: response.data.responseDetails || 'No translation found'
            });
        }
    } catch (apiErr) {
        // 3. 네트워크 오류 또는 API 서버 5xx 오류
        console.error('External API call error:', apiErr.message);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to connect to the external translation service.',
            details: apiErr.message
        });
    }

    // 4. DB 저장 로직 (이전과 동일)
    try {
        const result = await db.executeQuery(
            `INSERT INTO translations (original_text, translated_text, from_lang, to_lang)
             VALUES (:originalText, :translatedText, :fromLang, :toLang)
             RETURNING id INTO :id`,
            {
                originalText,
                translatedText, // MyMemory에서 받은 번역 결과
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
            translatedText, // 번역 결과도 함께 응답
            message: 'Translation saved successfully' 
        });

    } catch (dbErr) {
        console.error('Translation DB save error:', dbErr.message);
        res.status(500).json({ success: false, error: 'Failed to save translation history to database.', details: dbErr.message });
    }
});

// --- (이하 GET, DELETE 라우트는 동일합니다) ---

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
        res.status(500).json({ success: false, error: 'Failed to fetch translations', details: err.message });
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
        res.status(500).json({ success: false, error: 'Failed to fetch all translations', details: err.message });
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
            return res.status(404).json({ success: false, message: 'Translation not found' });
        }
        
        res.json({ success: true, message: 'Translation deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete translation', details: err.message });
    }
});

router.delete('/', async (req, res) => {
    try {
        const result = await db.executeQuery(
            `DELETE FROM translations`,
            [],
            { autoCommit: true }
        );
        
        res.json({ success: true, deletedCount: result.rowsAffected, message: 'All translations deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete all translations', details: err.message });
    }
});

module.exports = router;